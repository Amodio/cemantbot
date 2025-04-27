#!/usr/bin/env python3

import os
import sys
import time
import json
import secrets
import asyncio
import aiohttp
import numpy as np
from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo
from gensim.models import KeyedVectors

# Configuration
SOLUCE_DIR = '.'  # Directory to store solution files
RANDOM_SEED = 42  # Seed for reproducibility

# Calculate the day number for Cémantix
def day_number_cemantix() -> int:
    return (datetime.now(ZoneInfo('Europe/Paris')).date() - datetime(2022, 3, 2).date()).days

# Calculate the day number for Cemantle
def day_number_cemantle() -> int:
    return (datetime.now(ZoneInfo('America/Los_Angeles')).date() - datetime(2022, 4, 4).date()).days

# Load solution from file if it exists
def load_soluce(game: str, day: int):
    path = os.path.join(SOLUCE_DIR, f"{game}_soluce")
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            dayn, word, people, attempts, elapsed = line.strip().split()
            if int(dayn) == day:
                return {
                    'word': word,
                    'people': int(people),
                    'attempts': int(attempts),
                    'elapsed': float(elapsed)
                }
    return None

# Save solution to file
def save_soluce(game: str, day: int, word: str, people: int, attempts: int, elapsed: float):
    path = os.path.join(SOLUCE_DIR, f"{game}_soluce")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f"{day} {word} {people} {attempts} {elapsed:.2f}")

# Class for efficient similarity computations
class SimilaritySolver:
    def __init__(self, model: KeyedVectors):
        self.vocab = model.index_to_key
        self.vectors = model.get_normed_vectors()
        self.word2idx = {word: idx for idx, word in enumerate(self.vocab)}

    def candidates(self, target_word: str, similarity: float, tol: float = 1e-4) -> dict[str, float]:
        idx = self.word2idx.get(target_word)
        if idx is None:
            return {}
        vec = self.vectors[idx]
        sims = np.dot(self.vectors, vec)
        mask = np.abs(sims - similarity) <= tol
        idxs = np.where(mask)[0]
        return {
            self.vocab[i]: abs(sims[i] - similarity)
            for i in idxs if i != idx
        }

# Asynchronous function to fetch score
async def fetch_score(session, url: str, origin: str, word: str) -> tuple[float, int]:
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Origin': origin,
        'Referer': origin + '/'
    }
    async with session.post(url, headers=headers, data={'word': word}) as response:
        response.raise_for_status()
        data = await response.json()
        #print('[DBG] Requesting word', word, '->', data)
        if 'r' in data:
            raise ValueError('Invalid day number')
        if 'e' in data:
            raise ValueError('Invalid word')
        if 's' not in data or 'v' not in data:
            raise RuntimeError(f"Invalid response: {data}")
        return float(data['s']), int(data['v'])

# Main solving function
async def solve(game: str, model_path: str, day_fn: Callable):
    day = day_fn()
    origin = f"https://{game}.certitudes.org"
    cached = load_soluce(game, day)
    if cached:
        print(f"Cached: {cached['word']} found after {cached['people']} people in {cached['attempts']} attempts ({cached['elapsed']}s)")
        return

    print('Loading model...', end=' ')
    start_time = time.time()
    model = KeyedVectors.load_word2vec_format(model_path, binary=True, unicode_errors='ignore')
    solver = SimilaritySolver(model)
    url = f"{origin}/score?n={day}"

    rng = secrets.SystemRandom(RANDOM_SEED)
    tried_words = []
    counts = {}
    max_count = 0
    print(f"({(time.time() - start_time) * 1000:.2f} ms)")

    async with aiohttp.ClientSession() as session:
        # Iterative guessing
        while True:
            try:
                # Select the best candidate not yet tried
                best = min(
                    (c for c in counts if c not in tried_words and counts[c] == max_count),
                    key=lambda c: np.mean([
                        abs(np.dot(solver.vectors[solver.word2idx[c]], solver.vectors[solver.word2idx[t]]))
                        for t in tried_words if c in solver.word2idx and t in solver.word2idx
                    ]),
                    default=None
                )
                if not best:
                    best = rng.choice(solver.vocab)
                tried_words.append(best)
                s, v = await fetch_score(session, url, origin, best)
                if s == 1.0:
                    elapsed = time.time() - start_time
                    save_soluce(game, day, best, v, len(tried_words), elapsed)
                    print(f"{datetime.now()} {best} found after {v} people in {len(tried_words)} attempts ({elapsed:.2f}s)")
                    return
                candidates = solver.candidates(best, s)
                for candidate in candidates:
                    counts[candidate] = counts.get(candidate, 0) + 1
                    max_count = max(max_count, counts[candidate])
            except ValueError as err:
                if str(err) == 'Invalid day number':
                    eprint('[ERR] Invalid day...')
                    sys.exit(1)
                elif str(err) == 'Invalid word':
                    # If you see this.. it's time to update your model!
                    eprint('[WARN] Invalid word:', word)
                else:
                    panic(err)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        config = (
            'cemantix',
            './models/frWac_no_postag_phrase_500_cbow_cut10_stripped.bin',
            day_number_cemantix
        )
    else:
        config = (
            'cemantle',
            './CEMANTLE/models/GoogleNews-vectors-negative300_stripped.bin',
            day_number_cemantle
        )
    asyncio.run(solve(*config))