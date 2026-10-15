
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_router import get_current_user
from app.database import get_db
from app.llm_service import LLMServiceError
from app.models import ChatConversation, ChatMessage, User
from app.rag_service import answer_question


router = APIRouter(
    prefix="/chat/conversations",
    tags=["Chat History"],
)

MAX_HISTORY_MESSAGES = 6


class ConversationCreate(BaseModel):
    title: str = Field(
        default="New Conversation",
        min_length=1,
        max_length=255,
    )


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=50000)


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    metadata_json: str | None
    created_at: datetime


class ConversationDetail(ConversationResponse):
    messages: list[MessageResponse]


class ConversationAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=3, ge=1, le=5)
    verify_evidence: bool = False


def owned_conversation(
    db: Session,
    conversation_id: str,
    user_id: str,
) -> ChatConversation:
    conversation = db.scalar(
        select(ChatConversation).where(
            ChatConversation.id == conversation_id,
            ChatConversation.owner_id == user_id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return conversation


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=201,
)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = payload.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Conversation title cannot be empty.",
        )

    conversation = ChatConversation(
        owner_id=current_user.id,
        title=title,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.get(
    "",
    response_model=list[ConversationResponse],
)
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(ChatConversation)
        .where(ChatConversation.owner_id == current_user.id)
        .order_by(ChatConversation.updated_at.desc())
    ).all()


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = owned_conversation(
        db,
        conversation_id,
        current_user.id,
    )

    messages = db.scalars(
        select(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation.id
        )
        .order_by(
            ChatMessage.created_at.asc(),
            ChatMessage.id.asc(),
        )
    ).all()

    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            MessageResponse.model_validate(message)
            for message in messages
        ],
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=201,
)
def add_message(
    conversation_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = owned_conversation(
        db,
        conversation_id,
        current_user.id,
    )

    if payload.role != "user":
        raise HTTPException(
            status_code=400,
            detail="Only user messages can be submitted directly.",
        )

    message = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=payload.content,
    )

    conversation.updated_at = datetime.now(timezone.utc)

    db.add(message)
    db.commit()
    db.refresh(message)

    return message


@router.delete(
    "/{conversation_id}",
    status_code=204,
)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = owned_conversation(
        db,
        conversation_id,
        current_user.id,
    )

    messages = db.scalars(
        select(ChatMessage).where(
            ChatMessage.conversation_id == conversation.id
        )
    ).all()

    for message in messages:
        db.delete(message)

    db.delete(conversation)
    db.commit()

    return None


@router.post("/{conversation_id}/ask")
def ask_in_conversation(
    conversation_id: str,
    payload: ConversationAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Confirm this conversation belongs to the logged-in user.
    conversation = owned_conversation(
        db,
        conversation_id,
        current_user.id,
    )

    # Load the most recent messages in this conversation.
    # Descending order ensures we select the newest messages,
    # even when the conversation has a long history.
    recent_messages = db.scalars(
        select(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.role.in_(["user", "assistant"]),
        )
        .order_by(
            ChatMessage.created_at.desc(),
            ChatMessage.id.desc(),
        )
        .limit(MAX_HISTORY_MESSAGES)
    ).all()

    # Convert back into chronological order.
    conversation_history = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in reversed(recent_messages)
    ]

    try:
        # RAG will rewrite follow-up questions using this history.
        # Retrieved document passages remain the factual evidence.
        result = answer_question(
            db=db,
            question=payload.question,
            user_id=current_user.id,
            top_k=payload.top_k,
            verify_evidence=payload.verify_evidence,
            conversation_history=conversation_history,
        )

        if isinstance(result, BaseModel):
            response_data = result.model_dump(mode="json")
        elif isinstance(result, dict):
            response_data = result
        else:
            raise ValueError(
                "Unexpected RAG response format."
            )

        answer = response_data["answer"]

        user_message = ChatMessage(
            conversation_id=conversation.id,
            role="user",
            content=payload.question,
        )

        assistant_message = ChatMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=answer,
            metadata_json=json.dumps(response_data),
        )

        db.add_all([
            user_message,
            assistant_message,
        ])

        conversation.updated_at = datetime.now(timezone.utc)

        db.commit()

        return response_data

    except LLMServiceError as error:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    except ValueError as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to process your question.",
        )
