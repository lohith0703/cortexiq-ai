
from collections import Counter

from app.evidence_service import verify_evidence


TEST_CASES = [
    # Entailment: evidence supports the claim.
    {
        "evidence": "Jahnavi knows PostgreSQL and Python.",
        "claim": "Jahnavi knows PostgreSQL.",
        "expected": "entailment",
    },
    {
        "evidence": "The API uses FastAPI for backend development.",
        "claim": "The backend uses FastAPI.",
        "expected": "entailment",
    },
    {
        "evidence": "The database contains 500 customer records.",
        "claim": "The database has customer records.",
        "expected": "entailment",
    },

    # Contradiction: evidence directly conflicts with the claim.
    {
        "evidence": "The server is offline.",
        "claim": "The server is online.",
        "expected": "contradiction",
    },
    {
        "evidence": "The payment was rejected.",
        "claim": "The payment was approved.",
        "expected": "contradiction",
    },
    {
        "evidence": "The customer is 25 years old.",
        "claim": "The customer is 40 years old.",
        "expected": "contradiction",
    },

    # Neutral: evidence doesn't establish the claim.
    {
        "evidence": "Jahnavi knows PostgreSQL and Python.",
        "claim": "Jahnavi enjoys playing tennis.",
        "expected": "neutral",
    },
    {
        "evidence": "Jahnavi worked at Endava from 2024 to 2025.",
        "claim": "Jahnavi worked at Google for five years.",
        "expected": "neutral",
    },
    {
        "evidence": "The application uses PostgreSQL.",
        "claim": "The application is deployed on AWS.",
        "expected": "neutral",
    },
]


def evaluate_model():
    correct = 0
    total = len(TEST_CASES)

    per_class_total = Counter()
    per_class_correct = Counter()

    print("\nCORTEXIQ NLI MODEL EVALUATION")
    print("=" * 60)

    for index, case in enumerate(TEST_CASES, start=1):
        result = verify_evidence(
            evidence=case["evidence"],
            claim=case["claim"],
        )

        predicted = result["prediction"]
        expected = case["expected"]

        per_class_total[expected] += 1

        is_correct = predicted == expected

        if is_correct:
            correct += 1
            per_class_correct[expected] += 1

        status = "PASS" if is_correct else "FAIL"

        print(f"\nTest {index}: {status}")
        print(f"Expected: {expected}")
        print(f"Predicted: {predicted}")
        print(f"Scores: {result['scores']}")

    accuracy = correct / total

    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print(f"Correct predictions: {correct}/{total}")
    print(f"Accuracy: {accuracy:.2%}")

    print("\nPer-class accuracy:")

    for label in [
        "entailment",
        "contradiction",
        "neutral",
    ]:
        class_total = per_class_total[label]
        class_correct = per_class_correct[label]

        class_accuracy = (
            class_correct / class_total
            if class_total
            else 0.0
        )

        print(
            f"{label}: "
            f"{class_correct}/{class_total} "
            f"({class_accuracy:.2%})"
        )


if __name__ == "__main__":
    evaluate_model()
