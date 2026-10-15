
import numpy as np
from collections import Counter

from sentence_transformers import CrossEncoder

from tests.evaluate_nli import TEST_CASES


# Models we want to compare
MODELS = [
    "cross-encoder/nli-MiniLM2-L6-H768",
    "cross-encoder/nli-deberta-v3-small",
]


def evaluate_model(model_name):
    print("\n" + "=" * 60)
    print(f"Loading model: {model_name}")
    print("=" * 60)

    # Load the pretrained NLI model
    model = CrossEncoder(model_name)

    # Get the actual labels from the model configuration
    label_mapping = model.model.config.id2label

    print("Model labels:", label_mapping)

    # Prepare evidence and claim pairs
    pairs = [
        (case["evidence"], case["claim"])
        for case in TEST_CASES
    ]

    # Generate prediction scores for all test cases
    predictions = model.predict(
        pairs,
        apply_softmax=True,
    )

    correct = 0

    per_class_total = Counter()
    per_class_correct = Counter()

    # Evaluate each prediction
    for index, (case, prediction) in enumerate(
        zip(TEST_CASES, predictions),
        start=1,
    ):
        # Find the position of the highest probability
        predicted_index = int(np.argmax(prediction))

        # Convert the position into a label
        predicted_label = label_mapping[predicted_index]

        expected_label = case["expected"]

        per_class_total[expected_label] += 1

        is_correct = predicted_label == expected_label

        if is_correct:
            correct += 1
            per_class_correct[expected_label] += 1

        status = "PASS" if is_correct else "FAIL"

        print(f"\nTest {index}: {status}")
        print(f"Expected: {expected_label}")
        print(f"Predicted: {predicted_label}")

        # Display model confidence scores
        scores = {
            label_mapping[i]: round(float(score), 4)
            for i, score in enumerate(prediction)
        }

        print(f"Scores: {scores}")

    # Calculate overall accuracy
    total = len(TEST_CASES)
    accuracy = correct / total if total else 0.0

    print("\n" + "-" * 60)
    print("MODEL RESULTS")
    print("-" * 60)

    print(f"Model: {model_name}")
    print(f"Correct predictions: {correct}/{total}")
    print(f"Overall accuracy: {accuracy:.2%}")

    print("\nPer-class accuracy:")

    class_accuracies = {}

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

        class_accuracies[label] = class_accuracy

        print(
            f"{label}: "
            f"{class_correct}/{class_total} "
            f"({class_accuracy:.2%})"
        )

    return {
        "model": model_name,
        "correct": correct,
        "total": total,
        "accuracy": accuracy,
        "class_accuracies": class_accuracies,
    }


def main():
    results = []

    # Evaluate both models using the same dataset
    for model_name in MODELS:
        result = evaluate_model(model_name)
        results.append(result)

    # Display final comparison
    print("\n" + "=" * 60)
    print("CORTEXIQ — FINAL NLI MODEL COMPARISON")
    print("=" * 60)

    for result in results:
        print(f"\nModel: {result['model']}")
        print(
            f"Overall accuracy: "
            f"{result['correct']}/{result['total']} "
            f"({result['accuracy']:.2%})"
        )

        print("Per-class accuracy:")

        for label, accuracy in result[
            "class_accuracies"
        ].items():
            print(f"  {label}: {accuracy:.2%}")

    # Identify the model with the highest accuracy
    if results:
        best_model = max(
            results,
            key=lambda result: result["accuracy"],
        )

        print("\n" + "=" * 60)
        print("HIGHEST OVERALL ACCURACY")
        print("=" * 60)

        print(f"Model: {best_model['model']}")
        print(f"Accuracy: {best_model['accuracy']:.2%}")

        print(
            "\nNote: This is a small preliminary benchmark. "
            "Higher accuracy here does not guarantee "
            "better production performance."
        )


if __name__ == "__main__":
    main()
