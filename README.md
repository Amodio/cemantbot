# cemantbot
Bot for a web game where you have to guess a word each day (FR + EN).

## Installation
1) Activate the [developper mode in Chrome](https://www.tampermonkey.net/faq.php#Q209)
2) Install the [Tampermonkey browser extension](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
3) Add this [userscript](https://github.com/Amodio/cemantbot/raw/refs/heads/main/cemantbot_tampermonkey.user.js). If TamperMonkey does not let you install the script by clicking on the previous link, in the TamperMonkey extension menu go to the Dashboard > Utilities > Import from an URL and paste the previous URL.

## Usage
* Go to https://cemantix.certitudes.org or https://cemantle.certitudes.org
* Make sure the 'Joker!' button is here, otherwise refresh the page.

It takes about 6 sec to load (more at the first time to cache the binary model).
* Click the 'Joker!' button and enjoy!

![Joker button](https://raw.githubusercontent.com/Amodio/cemantix/main/images/joker_btn.png "Joker button")

![First](https://raw.githubusercontent.com/Amodio/cemantix/main/images/1st_17attempts.png "First")

![Cemantle in 6 attempts](https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/images/cemantle_6_attempts.png "Cemantle in 6 attempts")

## Notes
Models from [Jean-Philippe Fauconnier](https://fauconnier.github.io) and [Google](https://code.google.com/archive/p/word2vec/) (for Cemantle).

I have tested _55402_ [FR words](https://raw.githubusercontent.com/Amodio/cemantix/main/wordlist.txt "FR words") for this game even if some do not exist in French; _46212_ [EN words](https://raw.githubusercontent.com/Amodio/cemantix/main/wordlist.txt "EN words") for Cemantle. Check [benchmark.txt](https://raw.githubusercontent.com/Amodio/cemantix/main/benchmark/benchmark.txt) or [benchmark.txt](https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/benchmark/benchmark.txt) (Cemantle) to see how similar our models are: ~97% for Cémantix and 100% for Cemantle.

The author has added protections client-side to make this bot useless, but as long as the model is available, there is no use as the bot could fully run in WASM (or outside the browser) one day :)

Thanks to [vivien7806](https://github.com/vivien7806 "vivien7806") for the great help!