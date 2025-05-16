#!/usr/bin/env python3

import os
import sys
import time
import json
import secrets
import asyncio
import aiohttp
import numpy as np
from datetime import datetime
from zoneinfo import ZoneInfo
from gensim.models import KeyedVectors

SOLUCE_DIR = '.'    # Directory to store the solution files

# Class for efficient similarity computations
class SimilaritySolver:
    # O(n): Load words of the model with their vectors
    def __init__(self, model: KeyedVectors):
        self.vocab: List[str] = model.index_to_key # words
        self.vectors: np.ndarray = model.get_normed_vectors()
        # Lookup index: map each word of the model to its index
        self.word2idx: Dict[str, int] = {w: i for i, w in enumerate(self.vocab)}

    # O(n*D) {D=embedding dim}: Get the words whose cosine similarities to a given target_word are the closest
    def candidates(self, target_word: str, similarity: float) -> dict[str, float]:
        idx = self.word2idx.get(target_word)
        if idx is None:
            return {}
        vec = self.vectors[idx] # vector of the target_word
        # O(n*D): dot product between the target vector and all the normalized vectors of the model
        sims = np.dot(self.vectors, vec)
        # O(n): Mask the words/vectors where |cosine_distance[i] – cosine_distance| ≤ espilon
        mask = np.abs(sims - similarity) <= 1e-4 # this epsilon is great for our models and the precision we r given :>
        idxs = np.where(mask)[0]
        return {
            self.vocab[i]: abs(sims[i] - similarity)
            for i in idxs if i != idx
        }

# Calculate the day number of the given game
def day_number(game: str) -> int:
    if game == 'cemantix':
        return (datetime.now(ZoneInfo('Europe/Paris')).date() - datetime(2022, 3, 2).date()).days
    return (datetime.now(ZoneInfo('America/Los_Angeles')).date() - datetime(2022, 4, 4).date()).days

# Load solution from file if it exists
def load_soluce(game: str, day: int):
    path = os.path.join(SOLUCE_DIR, f"{game}_soluce")
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            dayn, word, validations, attempts, elapsed = line.strip().split()
            if int(dayn) == day:
                return {
                    'word': word,
                    'validations': int(validations),
                    'attempts': int(attempts),
                    'elapsed': float(elapsed)
                }
    return None

# Save solution to file
def save_soluce(game: str, day: int, word: str, validations: int, attempts: int, elapsed: float):
    path = os.path.join(SOLUCE_DIR, f"{game}_soluce")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f"{day} {word} {validations} {attempts} {elapsed:.2f}")

# Asynchronous function to fetch score
async def fetch_score(session, url: str, origin: str, word: str) -> tuple[float, int]:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Origin': origin,
        'Referer': origin + '/'
    }
    async with session.post(url, headers=headers, data={'word': word}) as response:
        response.raise_for_status()
        data = await response.json()
        #print('[DBG] Requested word:', word, '->', data)
        if 'r' in data:
            raise ValueError('Invalid day number')
        if 'e' in data:
            raise ValueError('Invalid word')
        if 's' not in data or 'v' not in data:
            raise RuntimeError(f"Invalid response: {data}")
        return float(data['s']), int(data['v'])

# Print the secret word and misc stats
def print_result(word: str, day: int, validations: int, attempts: int, elapsed: float, cached: bool=False):
    if cached:
        print('Cached:', end=' ')
    else:
        print(datetime.now(), end=' ')
    print(f"#{day} {word}, found", end=' ')
    if validations == 0:
        print('the first', end=', ')
    elif validations == 1:
        print('after 1 guy', end=' ')
    else:
        print(f"after {validations} prior validations", end=' ')
    print(f"in {attempts} attempts ({elapsed:.2f} ms).")

# Main solving function
async def solve(game: str, solver: SimilaritySolver, day: int, auto_retry: bool = True):
    start_time = time.time()
    origin = f"https://{game}.certitudes.org"
    url = f"{origin}/score?n={day}"
    tried_words = []
    counts = {}
    max_count = 0

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
                    best = solver.vocab[secrets.randbelow(len(solver.vocab))]
                    if best in tried_words:
                        continue
                tried_words.append(best)
                s, v = await fetch_score(session, url, origin, best)
                if s == 1.0:
                    elapsed = (time.time() - start_time) * 1000
                    save_soluce(game, day, best, v, len(tried_words), elapsed)
                    print_result(best, day, v, len(tried_words), elapsed)
                    return
                candidates = solver.candidates(best, s)
                for candidate in candidates:
                    counts[candidate] = counts.get(candidate, 0) + 1
                    max_count = max(max_count, counts[candidate])
            except ValueError as err:
                if str(err) == 'Invalid day number':
                    eprint('[ERR] Invalid day, retrying...')
                    if auto_retry:
                        return solve(game, model, day + 1, False)
                    else:
                        sys.exit(1)
                elif str(err) == 'Invalid word':
                    # If you see this.. it's time to update your model!
                    eprint('[WARN] Invalid word:', word)
                else:
                    panic(err)

def main():
    if len(sys.argv) < 2:
        game = 'cemantix'
        model_path = './models/frWac_no_postag_phrase_500_cbow_cut10_stripped.bin'
    else:
        game = 'cemantle'
        model_path = './CEMANTLE/models/GoogleNews-vectors-negative300_stripped.bin'

    # If we've already solved the game for today, print the result and exit
    day = day_number(game)
    cached = load_soluce(game, day)
    if cached:
        print_result(cached['word'], day, cached['validations'], cached['attempts'], cached['elapsed'], True)
        return

    # Load the word2vec model (normalized vectors of words)
    start_time = time.time()
    print(f"Loading model for {game}...", end=' ')
    model = KeyedVectors.load_word2vec_format(model_path, binary=True, unicode_errors='ignore')
    solver = SimilaritySolver(model)
    print(f"({(time.time() - start_time) * 1000:.2f} ms)")

    # Start solving the game
    asyncio.run(solve(game, solver, day))

if __name__ == '__main__':
    main()