
import numpy as np

from app.embedding_service import generate_embedding


sentences = [
    "Employees can work remotely three days per week.",
    "What is the company's work-from-home policy?",
    "The restaurant serves delicious pizza.",
]

embeddings = [
    generate_embedding(sentence)
    for sentence in sentences
]


def cosine_similarity(vector_a, vector_b):
    a = np.array(vector_a)
    b = np.array(vector_b)

    return float(
        np.dot(a, b)
        / (np.linalg.norm(a) * np.linalg.norm(b))
    )


print("\nCORTEXIQ EMBEDDING TEST")
print("-" * 40)

print("Embedding dimensions:", len(embeddings[0]))

print("\nFirst five embedding values:")
print(embeddings[0][:5])

print("\nSemantic similarity results:")

similarity_related = cosine_similarity(
    embeddings[0],
    embeddings[1],
)

similarity_unrelated = cosine_similarity(
    embeddings[0],
    embeddings[2],
)

print(
    "Remote work vs work-from-home:",
    round(similarity_related, 4),
)

print(
    "Remote work vs pizza:",
    round(similarity_unrelated, 4),
)

assert len(embeddings[0]) == 384

assert similarity_related > similarity_unrelated

print("\nEmbedding test passed!")
