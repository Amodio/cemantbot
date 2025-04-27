#!/usr/bin/env python3

from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo
import aiohttp, asyncio
import json
import os
import requests
import secrets
import sys
import time
from gensim.models import KeyedVectors

# Path of the solution cache
SOLUCE_DIR = '.'

# Calculate the day number for Cémantix
def day_number_cemantix() -> int:
    d = datetime.now(ZoneInfo('Europe/Paris')).date() - datetime(2022, 3, 2).date()
    return d.days    

# Calculate the day number for Cemantle
def day_number_cemantle() -> int:
    d = datetime.now(ZoneInfo('America/Los_Angeles')).date() - datetime(2022, 4, 4).date()
    return d.days    

# Load cached result if available and up-to-date
def load_soluce(game: str, day: int) -> bool:
    filename = os.path.join(SOLUCE_DIR, f'{game}_soluce')
    if not os.path.isfile(filename):
        return False
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) != 5:
                continue
            dayn, word, people_before, attempts, timestamp = parts
            try:
                if int(dayn) == day:
                    print_found_word(word, int(people_before), int(attempts), int(day), timestamp)
                    return True
            except ValueError as err:
                print(err)
                continue
    return False

# Save result into cache
def save_soluce(game: str, day: int, word: str, people_before: int, attempts: int, start_time: float):
    filename = os.path.join(SOLUCE_DIR, f'{game}_soluce')
    line = f'{day} {word} {people_before} {attempts} {time.time() - start_time:.2f}'
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(line)

# Fetch cosine distance for a given word from remote server
def get_temperature(url: str, origin: str, word: str) -> float:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Origin': origin,
        'Referer': origin + '/'
    }
    response = requests.post(url, headers=headers, data={'word': word})
    # Raise an error for bad status codes
    response.raise_for_status()
    assert response.status_code == 200, 'Invalid HTTP status code returned'
    data = json.loads(response.text)
    if 'r' in data:
        raise ValueError('Invalid day number')
    if 'e' in data:
        raise ValueError('Invalid word')
    if 's' not in data and 'v' not in data:
        raise RuntimeError('Invalid answer:', response.text)
    return data['s'], data['v']

# Asynchronous fetch of score for a given word
async def get_temperature_async(session: aiohttp.ClientSession, url: str, origin: str, word: str) -> tuple[float, int]:
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Origin': origin,
        'Referer': origin + '/'
    }
    async with session.post(url, headers=headers, data={'word': word}) as response:
        response.raise_for_status()
        payload = await response.json()
        if 'r' in payload:
            raise ValueError('Invalid day number')
        if 'e' in payload:
            raise ValueError('Invalid word')
        return payload['s'], payload['v']

def _mean_value(guess_words: dict[str, float], word: str) -> float:
    ret = 0.0
    n = 0
    for sublist in guess_words:
        for w in sublist:
            if w == word:
                ret += sublist[w]
                n += 1
    return ret / n

# Get the closest/best candidate words to try with their respective delta with the cosine_distance of tried_word
# O(n)
def _guess_da_magic_word(model, tried_word: str, cosine_distance: float, epsilon: float = 1e-4) -> dict[str, float]:
    #print(f'{tried_word=} {epsilon=}')
    # Should never happen
    if epsilon == 1:
        raise ValueError('No candidates?')
    ret = {}
    lower_boundary = cosine_distance - epsilon
    upper_boundary = cosine_distance + epsilon
    for word in model.index_to_key:
         sim = model.similarity(word, tried_word)
         if lower_boundary <= sim <= upper_boundary:
            ret[word] = abs(cosine_distance - sim) # store the delta
    # Just in case but should not be reached with our models :)
    if len(ret) == 0:
        return _guess_da_magic_word(model, tried_word, cosine_distance, epsilon*10)
    return ret

def print_found_word(word: str, v: int, attempts: int, day_number: int, elapsed: str):
    print(f'Day #{day_number}: {word} found', end=' ')
    if v == 0:
        print('the first', end=' ')
    elif v == 1:
        print('after 1 person', end=' ')
    else:
        print('after', v, 'people', end=' ')
    print(f'in {attempts} attemps and {elapsed} seconds')

def compute_answer(model, game: str, day_number: int, start_time: float, guess_words: list[dict[str, float]], word_counts: dict[str, int], max_occurrence: int, tried_words: list[str], word: str, s:float, v:int) -> bool:
    if s == 1:
        save_soluce(game, day_number, word, v, len(tried_words), start_time)
        print_found_word(word, v, len(tried_words), day_number, f'{time.time() - start_time:.2f}')
    else:
        sorted_dict = _guess_da_magic_word(model, word, s)
        guess_words.append(sorted_dict)
        for w in sorted_dict:
            if w in word_counts:
                word_counts[w] += 1
            else:
                word_counts[w] = 1
            if word_counts[w] > max_occurrence:
                max_occurrence = word_counts[w]
    return max_occurrence

def main_loop(model, game: str, origin: str, day_number: Callable, start_time: float, guess_words: list[dict[str, float]], word_counts: dict[str, int], max_occurrence: int, tried_words: list[str]) -> str:
    dayn = day_number()
    url = origin + '/score?n=' + str(dayn)
    while True:
        try:
            # O(1)
            # 1. First two words are totally random for speeding the total solving time.
            # This ensures we have at least two words with their distances to the secret one.
            if len(guess_words) <= 1:
                word = model.index_to_key[secrets.randbelow(len(model))]
                if word in tried_words:
                    continue
            else:
                # O(tried_words*candidate_words) candidate_words depends on epsilon
                # 2. Get the most frequent word of the candidates (closest to the solution)
                delta = 31337
                word = ''
                for sublist in guess_words:
                    for w in sublist:
                        if word_counts[w] == max_occurrence and w not in tried_words:
                            meanv = _mean_value(guess_words, w)
                            if delta > meanv:
                                delta = meanv
                                word = w
            if word == '':
                raise ValueError('No best candidate?')
            #print('testing:',word)
            tried_words.append(word)
            s, v = get_temperature(url, origin, word)
            max_occurrence = compute_answer(model, game, dayn, start_time, guess_words, word_counts, max_occurrence, tried_words, word, s, v)
            if s == 1:
                return word
        except ValueError as err:
            if str(err) == 'Invalid day number':
                print('Invalid day...')
                # sleep a sec and retry from scratch
                time.sleep(1)
                guess_words = []
                tried_words = []
                word_counts = {} # Frequency map
                max_occurrence = 0
                return main_loop(model, game, origin, day_number, start_time, guess_words, word_counts, max_occurrence, tried_words)
            elif str(err) == 'Invalid word':
                # If you see this.. it's time to update your model!
                print('[WARN] Invalid word:', word)
    # Should never be reached
    raise ValueError('?')

async def main():
    total_time = time.time()
    if len(sys.argv) < 2:
        model_path = './models/frWac_no_postag_phrase_500_cbow_cut10_stripped.bin'
        game = 'cemantix'
        day_number = day_number_cemantix
    else:
        model_path = './CEMANTLE/models/GoogleNews-vectors-negative300_stripped.bin'
        game = 'cemantle'
        day_number = day_number_cemantle
    # Load/print the secret word from local file if ready (game already solved today)
    if load_soluce(game, day_number()):
        return
    origin ='https://' + game + '.certitudes.org'
    start_time = time.time()
    model = KeyedVectors.load_word2vec_format(model_path, binary=True, unicode_errors='ignore')
    print(f'Model loaded in {(time.time() - start_time) * 1000:.2f} ms')
    start_time = time.time()

    guess_words = [] # Candidate words (with their delta)
    tried_words = []
    word_counts = {} # Frequency map
    max_occurrence = 0

    url = origin + '/score?n=' + str(day_number())
    # speed up things by sending the first two attempts asynchronously
    word1 = model.index_to_key[secrets.randbelow(len(model))]
    tried_words.append(word1)
    while True:
        word2 = model.index_to_key[secrets.randbelow(len(model))]
        if word2 not in tried_words:
            break
    tried_words.append(word2)
    #print(f'Testing random words: {word1} & {word2}')
    async with aiohttp.ClientSession() as session:
        # Fire off both requests concurrently
        tasks = [
            get_temperature_async(session, url, origin, word)
            for word in (word1, word2)
        ]
        results = await asyncio.gather(*tasks)

    for word, (s, v) in zip((word1, word2), results):
        max_occurrence = compute_answer(model, game, day_number, start_time, guess_words, word_counts, max_occurrence, tried_words, word, s, v)

    print(f'First two words done in {time.time() - start_time:.2f} seconds')
    main_loop(model, game, origin, day_number, total_time, guess_words, word_counts, max_occurrence, tried_words)

if __name__ == '__main__':
    asyncio.run(main())