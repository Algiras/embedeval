#!/usr/bin/env python3
"""
Download and prepare Hugging Face datasets for EmbedEval
Supports MTEB, SQuAD, MSMARCO, and other popular benchmarks
"""

import json
import os
import sys
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    print("❌ datasets library not installed")
    print("Install with: pip install datasets")
    sys.exit(1)

def ensure_dir(path):
    """Create directory if it doesn't exist"""
    Path(path).mkdir(parents=True, exist_ok=True)

def save_jsonl(data, filepath):
    """Save data as JSONL file"""
    with open(filepath, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    print(f"  ✓ Saved {len(data)} records to {filepath}")

def download_mteb_sts17():
    """Download MTEB STS17 cross-lingual dataset"""
    print("\n📥 Downloading MTEB STS17...")
    
    try:
        # Load English-English pairs
        dataset = load_dataset("mteb/sts17-crosslingual-sts", "en-en", split="test")
        
        queries = []
        corpus = []
        
        for i, item in enumerate(dataset):
            query_id = f"sts17-en-en-{i}"
            
            # Add query
            queries.append({
                "id": query_id,
                "query": item["sentence1"],
                "relevantDocs": [f"sts17-doc-{i}"],
                "relevanceScores": [item["score"] / 5.0],  # Normalize 0-5 to 0-1
                "tags": ["sts", "en-en"]
            })
            
            # Add document
            corpus.append({
                "id": f"sts17-doc-{i}",
                "content": item["sentence2"],
                "metadata": {"score": item["score"]}
            })
        
        ensure_dir("datasets/mteb")
        save_jsonl(queries, "datasets/mteb/sts17-en-en-queries.jsonl")
        save_jsonl(corpus, "datasets/mteb/sts17-en-en-corpus.jsonl")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def download_squad_sample():
    """Download SQuAD sample for quick testing"""
    print("\n📥 Downloading SQuAD sample...")
    
    try:
        dataset = load_dataset("squad", split="validation[:100]")  # First 100 examples
        
        queries = []
        corpus = []
        seen_contexts = {}
        
        for i, item in enumerate(dataset):
            context = item["context"]
            
            # Deduplicate contexts
            if context not in seen_contexts:
                doc_id = f"squad-doc-{len(seen_contexts)}"
                seen_contexts[context] = doc_id
                corpus.append({
                    "id": doc_id,
                    "content": context,
                    "metadata": {"title": item["title"]}
                })
            else:
                doc_id = seen_contexts[context]
            
            queries.append({
                "id": f"squad-q-{i}",
                "query": item["question"],
                "relevantDocs": [doc_id],
                "relevanceScores": [1.0],
                "tags": ["qa", "squad"]
            })
        
        ensure_dir("datasets/squad")
        save_jsonl(queries, "datasets/squad/queries.jsonl")
        save_jsonl(corpus, "datasets/squad/corpus.jsonl")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def download_quora_sample():
    """Download Quora question pairs sample"""
    print("\n📥 Downloading Quora sample...")
    
    try:
        dataset = load_dataset("quora", split="train[:200]")  # First 200 pairs
        
        queries = []
        corpus = []
        seen_questions = {}
        
        for i, item in enumerate(dataset):
            q1 = item["questions"]["text"][0]
            q2 = item["questions"]["text"][1]
            is_duplicate = item["is_duplicate"]
            
            # Add questions to corpus if not seen
            for j, q in enumerate([q1, q2]):
                if q not in seen_questions:
                    q_id = f"quora-q-{len(seen_questions)}"
                    seen_questions[q] = q_id
                    corpus.append({
                        "id": q_id,
                        "content": q,
                        "metadata": {}
                    })
            
            # Only add as query if it's a duplicate (for evaluation)
            if is_duplicate:
                q1_id = seen_questions[q1]
                q2_id = seen_questions[q2]
                
                queries.append({
                    "id": f"quora-pair-{i}",
                    "query": q1,
                    "relevantDocs": [q2_id],
                    "relevanceScores": [1.0],
                    "tags": ["duplicate", "quora"]
                })
        
        ensure_dir("datasets/quora")
        save_jsonl(queries, "datasets/quora/queries.jsonl")
        save_jsonl(corpus, "datasets/quora/corpus.jsonl")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def download_nfcorpus_sample():
    """Download NFCorpus sample (medical retrieval)"""
    print("\n📥 Downloading NFCorpus sample...")
    
    try:
        dataset = load_dataset("mteb/nfcorpus", split="test[:100]")
        
        queries = []
        corpus = []
        seen_docs = {}
        
        for i, item in enumerate(dataset):
            query = item["query"]
            
            # Get relevant documents
            relevant = []
            scores = []
            
            if "corpus-id" in item:
                doc_id = f"nfcorpus-{item['corpus-id']}"
                relevant.append(doc_id)
                scores.append(1.0)
                
                # Add to corpus if not seen
                if doc_id not in seen_docs:
                    seen_docs[doc_id] = True
                    corpus.append({
                        "id": doc_id,
                        "content": item.get("corpus-text", f"Document {doc_id}"),
                        "metadata": {"medical": True}
                    })
            
            if relevant:
                queries.append({
                    "id": f"nfcorpus-q-{i}",
                    "query": query,
                    "relevantDocs": relevant,
                    "relevanceScores": scores,
                    "tags": ["medical", "nfcorpus"]
                })
        
        ensure_dir("datasets/nfcorpus")
        save_jsonl(queries, "datasets/nfcorpus/queries.jsonl")
        save_jsonl(corpus, "datasets/nfcorpus/corpus.jsonl")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def create_sample_dataset():
    """Create a small sample dataset for testing"""
    print("\n📥 Creating sample dataset...")
    
    queries = [
        {
            "id": "q1",
            "query": "What is machine learning?",
            "relevantDocs": ["d1", "d2"],
            "relevanceScores": [1.0, 0.8],
            "tags": ["technical"]
        },
        {
            "id": "q2",
            "query": "How to bake sourdough bread?",
            "relevantDocs": ["d3"],
            "relevanceScores": [1.0],
            "tags": ["cooking"]
        },
        {
            "id": "q3",
            "query": "Best Python web frameworks",
            "relevantDocs": ["d4", "d5"],
            "relevanceScores": [1.0, 0.9],
            "tags": ["programming"]
        },
        {
            "id": "q4",
            "query": "Climate change effects",
            "relevantDocs": ["d6"],
            "relevanceScores": [1.0],
            "tags": ["science"]
        },
        {
            "id": "q5",
            "query": "Introduction to quantum computing",
            "relevantDocs": ["d7", "d8"],
            "relevanceScores": [1.0, 0.7],
            "tags": ["technical"]
        }
    ]
    
    corpus = [
        {
            "id": "d1",
            "content": "Machine learning is a subset of artificial intelligence that enables computers to learn from data without explicit programming.",
            "metadata": {"category": "ai"}
        },
        {
            "id": "d2",
            "content": "Deep learning uses neural networks with multiple layers to model complex patterns in data.",
            "metadata": {"category": "ai"}
        },
        {
            "id": "d3",
            "content": "Sourdough bread requires a starter culture of wild yeast and bacteria to ferment the dough.",
            "metadata": {"category": "cooking"}
        },
        {
            "id": "d4",
            "content": "Django is a high-level Python web framework that encourages rapid development and clean design.",
            "metadata": {"category": "programming"}
        },
        {
            "id": "d5",
            "content": "Flask is a lightweight Python web framework that is easy to get started with.",
            "metadata": {"category": "programming"}
        },
        {
            "id": "d6",
            "content": "Climate change refers to long-term shifts in global temperatures and weather patterns.",
            "metadata": {"category": "science"}
        },
        {
            "id": "d7",
            "content": "Quantum computing uses quantum bits or qubits to perform calculations exponentially faster.",
            "metadata": {"category": "physics"}
        },
        {
            "id": "d8",
            "content": "Quantum mechanics describes the behavior of matter and energy at the atomic scale.",
            "metadata": {"category": "physics"}
        }
    ]
    
    ensure_dir("datasets/sample")
    save_jsonl(queries, "datasets/sample/queries.jsonl")
    save_jsonl(corpus, "datasets/sample/corpus.jsonl")
    
    return True

def main():
    """Main function to download all datasets"""
    print("🚀 Hugging Face Dataset Downloader for EmbedEval")
    print("=" * 60)
    
    results = {}
    
    # Download datasets
    results["sample"] = create_sample_dataset()
    results["sts17"] = download_mteb_sts17()
    results["squad"] = download_squad_sample()
    results["quora"] = download_quora_sample()
    results["nfcorpus"] = download_nfcorpus_sample()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Download Summary")
    print("=" * 60)
    
    for name, success in results.items():
        status = "✅" if success else "❌"
        print(f"{status} {name}")
    
    successful = sum(1 for s in results.values() if s)
    print(f"\n✓ Downloaded {successful}/{len(results)} datasets")
    
    print("\n📁 Dataset locations:")
    print("  - datasets/sample/ (for testing)")
    print("  - datasets/mteb/ (MTEB benchmarks)")
    print("  - datasets/squad/ (question answering)")
    print("  - datasets/quora/ (duplicate detection)")
    print("  - datasets/nfcorpus/ (medical retrieval)")
    
    print("\n🎯 Next steps:")
    print("  1. Run evaluation: embedeval ab-test --config examples/hf-evaluations/mteb-sts17.yaml")
    print("  2. View results: open results/*/dashboard.html")
    print("  3. Compare models: embedeval ab-test --config examples/hf-evaluations/comparison.yaml")
    
    return successful == len(results)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
