# cemantbot
Bot for a web game where you have to guess a word each day (FR + EN).

## Installation
1) Activate the [developper mode in Chrome](https://www.tampermonkey.net/faq.php#Q209).
2) Install the [Tampermonkey browser extension](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
3) Click on [userscript](https://github.com/Amodio/cemantbot/raw/refs/heads/main/cemantbot_tampermonkey.user.js). If TamperMonkey does not let you install it, in the extension menu go to the `Dashboard > Utilities > Import from an URL` and paste the previous URL.

If paranoid, you may want to restrict its access to: `https://*.certitudes.org/*` & `https://raw.githubusercontent.com/*`

## Usage
* Go to https://cemantix.certitudes.org or https://cemantle.certitudes.org
* Make sure the 'Joker!' button is loaded, otherwise refresh the page.

It takes about 6 sec to load (more at the first time to cache the binary model).
* Click the 'Joker!' button, enjoy!

![Joker button](https://raw.githubusercontent.com/Amodio/cemantix/main/images/joker_btn.png "Joker button")

![First](https://raw.githubusercontent.com/Amodio/cemantix/main/images/1st_17attempts.png "First")

![Cemantle in 6 attempts](https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/images/cemantle_6_attempts.png "Cemantle in 6 attempts")

## Description
The main algorithm is now drastically improved: it should **find the secret word in 3 attempts/words and less than 5 seconds** :)
You can either try the first two words yourself, or let the bot randomly choose the first one and continue.

It basically bruteforces the cosine distance (temperature) for every tried word and selects the closest candidate.

The fallback algorithm (that should never be reached anyways) uses dot-product (scalar product) scores to converge to the secret word's vector embedding v by:
1. assembling a small linear system with known query-word vectors (b<sub>i</sub> =⟨v,w<sub>i</sub>⟩ where w<sub>i</sub> are the known Word2Vec distances to the secret word),
2. solving for v the least-squares solution minimizing ‖A v − b‖₂,
3. finding the nearest neighbor for v in the Gensim/word2vec model and trying it,
4. restarting until the secret word is found.

## Notes
Models from [Jean-Philippe Fauconnier](https://fauconnier.github.io) and [Google](https://code.google.com/archive/p/word2vec/) (for Cemantle).

I have tested _55402_ [FR words](https://raw.githubusercontent.com/Amodio/cemantix/main/wordlist.txt "FR words") for this game even if some do not exist in French; _46212_ [EN words](https://raw.githubusercontent.com/Amodio/cemantix/main/wordlist.txt "EN words") for Cemantle. Check [benchmark.txt](https://raw.githubusercontent.com/Amodio/cemantix/main/benchmark/benchmark.txt) or [benchmark.txt](https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/benchmark/benchmark.txt) (Cemantle) to see how similar our models are: ~97% for Cémantix and 100% for Cemantle.

The author has added protections client-side to make this bot useless, but as long as the model was published, there is no use as the bot could fully run in WASM (or outside the browser) one day (eventually storing the result by solving it daily with github actions) :)

Thanks to [vivien7806](https://github.com/vivien7806 "vivien7806") for the great help!