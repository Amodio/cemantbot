# cemantbot
Bot for a web game where you have to guess a word each day (FR + EN).

## Installation
* Activate the [developper mode in Chrome](https://www.tampermonkey.net/faq.php#Q209)
* Install the [Tampermonkey browser extension](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
* Add this [userscript](https://raw.githubusercontent.com/Amodio/cemantbot/refs/heads/main/cemantbot_tampermonkey.js). If TamperMonkey does not let you install the script by clicking on the previous link, in the TamperMonkey extension menu go to the Dashboard > Utilities > Import from an URL and paste the previous URL.

## Usage
* Go to https://cemantix.certitudes.org or https://cemantle.certitudes.org
* Make sure the 'Joker!' button is here, otherwise keep refreshing the page (Ctrl+Shift+R), as our script needs to get loaded before the author's ones (that includes a protection).

It takes about 6 sec to load (more at the first time to cache the binary model).
* Click the 'Joker!' button and enjoy!

![Joker button](https://raw.githubusercontent.com/Amodio/cemantix/main/images/joker_btn.png "Joker button")

![First](https://raw.githubusercontent.com/Amodio/cemantix/main/images/1st_17attempts.png "First")

![Cemantle in 6 attempts](https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/images/cemantle_6_attempts.png "Cemantle in 6 attempts")

## Notes
Models from [Jean-Philippe Fauconnier](https://fauconnier.github.io) and [Google](https://code.google.com/archive/p/word2vec/) (for Cemantle).

I have tested _55402_ [FR words](https://raw.githubusercontent.com/Amodio/cemantix/main/wordlist.txt "FR words") for this game even if some do not exist in French; _46212_ [EN words](https://raw.githubusercontent.com/Amodio/cemantix/main/wordlist.txt "EN words") for Cemantle. Check [benchmark.txt](https://raw.githubusercontent.com/Amodio/cemantix/main/benchmark/benchmark.txt) or [benchmark.txt](https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/benchmark/benchmark.txt) (Cemantle) to see how similar our models are: ~97% for Cémantix and 100% for Cemantle.

As the author has added protections client-side (the second one has been added a few days after I bypassed the previous protection and forces the user to reload the script if it was not loaded before the webpage), it would be salutary (as that would run a bit faster) to directly request the server in WASM and call back the javascript function to add the scores of the words.

Thanks to [vivien7806](https://github.com/vivien7806 "vivien7806") for the great help!
