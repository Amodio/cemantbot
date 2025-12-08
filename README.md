# cemantbot
Bot for a web game where you have to guess a word each day (FR + EN).

## Installation
1) For Chrome, activate the [developper mode](https://www.tampermonkey.net/faq.php#Q209) and install the [Tampermonkey extension](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo); for Firefox, install [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
2) Click on the [cemantbot userscript](https://github.com/Amodio/cemantbot/raw/refs/heads/main/cemantbot_tampermonkey.user.js) then install. If TamperMonkey does not launch, paste the previous URL into: `Dashboard > Utilities > Import from an URL`.

If paranoid on Chrome, you can restrict TamperMonkey's access only to: `https://*.certitudes.org/*` & `https://raw.githubusercontent.com/*`.

## Usage
* Go to https://cemantix.certitudes.org or https://cemantle.certitudes.org
* Make sure the 'Joker!' button is loaded, otherwise refresh the page (takes ~6 sec to fully load, more at first to cache the binary model).
* Click the 'Joker!' button, enjoy!

![Joker button](https://raw.githubusercontent.com/Amodio/cemantbot/main/images/joker_btn.png "Joker button")

![First](https://raw.githubusercontent.com/Amodio/cemantbot/main/images/1st_17attempts.png "First")

![Cemantle in 6 attempts](https://raw.githubusercontent.com/Amodio/cemantbot/main/CEMANTLE/images/cemantle_6_attempts.png "Cemantle in 6 attempts")

## Description
The main algorithm is now drastically improved: it should **find the secret word in 3 attempts/words and less than 5 seconds** :)
You can either try the first two words yourself, or let the bot randomly choose the first one and continue.

It basically bruteforces the cosine distance (temperature) for every tried word and selects the closest candidate.

The fallback algorithm (that should never be reached anyways) uses dot-product (scalar product) scores to converge to the secret word's vector embedding v by:
1. assembling a small linear system with known query-word vectors (b<sub>i</sub> =⟨v,w<sub>i</sub>⟩ where w<sub>i</sub> are the known Word2Vec distances to the secret word),
2. solving for v the least-squares solution minimizing ‖A v − b‖₂,
3. finding the nearest neighbor for v in the Gensim/word2vec model and trying it,
4. restarting until the secret word is found.

## Standalone script
```
git clone https://github.com/Amodio/cemantbot.git
cd cemantbot/
pip3 install aiohttp gensim numpy --break-system-packages # (or use python -m venv cemantbot)
python3 ./cemantbot.py # add any argument to solve Cemantle instead of Cémantix
```

## Notes
Models from [Jean-Philippe Fauconnier](https://fauconnier.github.io) and [Google](https://code.google.com/archive/p/word2vec/) (for Cemantle).

I have tested _55402_ valid words on Cémantix (even if some do not exist in French); _46212_ for Cemantle.
There's a 100% match between the model I have stripped from Google and the one used by Cemantle; 97% for Cémantix, as accents were a problem).

The author has added protections client-side to make this bot useless (suspicious timing), so there's a standalone version of the bot now (just in case more protections were added).

Thanks to [vivien7806](https://github.com/vivien7806 "vivien7806") for the great help!
