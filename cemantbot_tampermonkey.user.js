// ==UserScript==
// @name         Cemantix/Cemantle bot
// @namespace    https://github.com/Amodio
// @version      2025-04-27
// @description  Bot for Cemantix/Cemantle word games
// @author       Amodio
// @match        https://cemantix.certitudes.org/*
// @match        https://cemantle.certitudes.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=certitudes.org
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @connect      static.certitudes.org
// ==/UserScript==

(function() {
    'use strict';
    const myTimeout = 30; // Time (milliseconds) to wait between each try
    let startTime = 0;
    let durationTime = 0;
    const processingStr = '<span class="button__text">Processing...</span>';
    const waitStr = '<span class="button__text">Loading...</span>';
    const waitStr2 = '<span class="button__text">Please wait...</span>';
    const jokerStr = '<span class="button__text">&nbsp;&nbsp;&nbsp; Joker!&nbsp;&nbsp;&nbsp;</span>';
    let tried_words = 0;
    let pyodide;
    const similarities = new Map(); // Our map containing the words tried w/ distances

    // Bypass the rules window (appearing on first loading of the page) if needed
    if (localStorage.getItem('readRules') !== 'true') {
        localStorage.setItem('readRules', true);
    }

    // Bypass the protection the author wrote to return mocked scores
    // 1) Observe all <script type="module"> tags, as they are added to the page
    const observer = new MutationObserver(muts => {
        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (
                    node.tagName === 'SCRIPT' &&
                    node.type === 'module' &&
                    (node.src.includes('cemantle.js') || node.src.includes('cemantix.js'))
                ) {
                    const savedId = node.id;
                    const savedSrc = node.src;
                    const savedPuzzleNumber = node.getAttribute('data-puzzle-number');
                    const savedUtcTime = node.getAttribute('data-utc-time');
                    const savedDataApp = node.getAttribute('data-app');
                    // Stop observing so we only patch once
                    observer.disconnect();
                    // Prevent the browser from loading the original module
                    node.remove();
                    // Fetch, patch, and re-insert module
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: savedSrc,
                        onload(response) {
                            let origCode = response.responseText;
                            // 2) Remove the protection
                            let patchedCode = origCode.replace(/10!=Error\.stackTraceLimit\|\|r&&4<r\.split\("\\n"\)\.length/, 'false');
                            if (origCode === patchedCode) {
                                throw new Error("Cannot patch remote script, maybe it got changed...");
                            }
                            // Needed as we no longer load the script directly from remote server
                            patchedCode = patchedCode.replace(
                                /from\s*['"]\.\/cemantle-base\.js['"]/g,
                                `from "https://static.certitudes.org/html/cemantle-base.js"`
                            );
                            patchedCode = patchedCode.replace(
                                /from\s*['"]\.\/cemantix-base\.js['"]/g,
                                `from "https://static.certitudes.org/html/cemantix-base.js"`
                            );
                            patchedCode = patchedCode.replace(
                                /window\.addEventListener\("load",async\(\)=>e\.init\(\)\);/g,
                                `e.init();`
                            );
                            //patchedCode += 'e.init();';
                            let newScript = document.createElement('script');
                            // 3) Add the patched script back
                            newScript.id = savedId;
                            newScript.type = 'module';
                            newScript.textContent = patchedCode;
                            //newScript.setAttribute('src', savedSrc);
                            newScript.setAttribute('data-puzzle-number', savedPuzzleNumber);
                            newScript.setAttribute('data-utc-time', savedUtcTime);
                            newScript.setAttribute('data-app', savedDataApp);
                            document.querySelector('head').appendChild(newScript);
                            // Finally, inject our code :)
                            injectScript('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js', addButton);
                        }
                    });
                }
            }
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    function sleep(delay) {
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    function secondsToTime(e){
        const m = Math.floor(e / 60).toString().padStart(2, '0');
        if (m == '00') {
            return Math.floor(e % 60).toString() + 's';
        }
        return m + 'm' + Math.floor(e % 60).toString().padStart(2, '0') + 's';
    }

    async function tryWord(word) {
        const cemant_guess = 'guess';
        const cemant_error = 'error';
        if (word.indexOf(' ') == -1 && word.length > 1) {
            document.getElementById(cemant_guess).value = word;
            while (document.getElementById(cemant_guess).disabled) {
                await sleep(myTimeout);
            }
            while (document.getElementById(cemant_guess).value != '') {
                document.getElementById(cemant_guess + '-btn').click();
                await sleep(myTimeout);
            }
            while (document.getElementById(cemant_error).innerHTML.indexOf(word) == -1 && localStorage.guesses && localStorage.guesses.indexOf(word) == -1) {
                await sleep(myTimeout);
            }
            if (localStorage.guesses) {
                let tmp = JSON.parse(localStorage.guesses)[word]
                if (localStorage.secret !== undefined || tmp && tmp.length > 0 && tmp[1].length > 0 && tmp[1][1] == 1000) {
                    document.getElementById("button3").classList.toggle("button--loading");
                    //console.timeEnd('joker');
                    durationTime += Date.now() - startTime;
                    console.log(`Word found in: ${secondsToTime(durationTime / 1000)}.`);
                    document.getElementById("button3").innerHTML = `<span class="button__text">Found in ${secondsToTime(durationTime / 1000)}!</span>`;
                }
            }
        }
    }

    // This function is called when the 'Joker!' button is clicked on
    function toggleButton() {
        const element = document.getElementById("button3");
        if (element.innerHTML == jokerStr) {
            element.innerHTML = processingStr;
            //console.time('joker');
            startTime = Date.now();
            // This function is called while the 'Joker!' button is active
            (async function () {
                while (document.getElementById("button3").innerHTML == processingStr) {
                    // getNextWord: XXX: Get rid of this conversion?
                    const tmp = JSON.parse(localStorage.getItem("guesses"));

                    // Update the similarities (words) map if the user has added some
                    if (tmp != null && tried_words != Object.keys(tmp).length) {
                        similarities.clear();
                        // `[word, [try_number, [temp, 1000_closeness]], ...]` -> `word:temp, ...`
                        for (const [word, [, [temp]]] of Object.entries(tmp)) {
                            similarities.set(word, temp/100);
                        }
                        tried_words = Object.keys(tmp).length;
                    }

                    let output = await pyodide.runPython(`
sim_dict = similarities.to_py()
master_guesser()
`);
                    await tryWord(output);
                }
            })();
            element.classList.toggle("button--loading");
        } else if (element.innerHTML == processingStr) {
            element.innerHTML = jokerStr;
            if (startTime != 0) {
                durationTime += Date.now() - startTime;
                startTime = 0;
            }
            element.classList.toggle("button--loading");
        }
    }

    // Load the correct word2vec model in Python WASM, caching it
    async function loadPythonModel() {
        console.time('loadPythonModel total (~6s)');
        console.time('loadPythonModel: load gensim pkg with Pyodide (~3s)');
        pyodide = await loadPyodide(); // eslint-disable-line no-undef
        await pyodide.loadPackage('gensim');
        console.timeEnd('loadPythonModel: load gensim pkg with Pyodide (~3s)');
        console.time('loadPythonModel: download');
        const fetchUrl = (window.location.hostname.split('.')[0] == 'cemantix' ? 'https://media.githubusercontent.com/media/Amodio/cemantbot/refs/heads/main/models/frWac_no_postag_phrase_500_cbow_cut10_stripped.bin' : 'https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/models/GoogleNews-vectors-negative300_stripped.bin');
        let response = await caches.open('cemanbot').then(function(cache) {
            return cache.match('model.bin').then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(fetchUrl).then(function(response) {
                    if (!response.ok) {
                        throw new Error("HTTP error, status = " + response.status);
                    }
                    cache.put('model.bin', response.clone());
                    return response;
                });
            });
        });
        document.getElementById("button3").innerHTML = waitStr2;
        document.head.contents = await response.arrayBuffer();
        console.timeEnd('loadPythonModel: download');
        console.time('loadPythonModel: load downloaded model (~3s)');
        pyodide.runPython(`
from gensim.models import KeyedVectors
import js
import numpy as np
import secrets

model_name = '/model.bin'
with open(model_name, 'wb') as fh:
    js.document.head.contents.to_file(fh)

model = KeyedVectors.load_word2vec_format(model_name, binary=True, unicode_errors='ignore')
guess_words = []
tested_words = []

# Fallback method using least squares
def _next_word_to_try():
    print("[INFO] We have used the fallback method...")
    # 1. Build the coefficient matrix A and vector b (known distances)
    words = list(sim_dict.keys())
    A = np.vstack([model[w] for w in words])
    b = np.array([sim_dict[w] for w in words])
    # 2. Solve via least squares
    v, residuals, rank, s = np.linalg.lstsq(A, b, rcond=None)
    # 3. Normalize for cosine similarity
    v_norm = v / np.linalg.norm(v)
    # 4. Find the nearest word in the model
    for guess_word, similarity in model.similar_by_vector(v_norm, topn=len(sim_dict)+len(tested_words)+1):
        if guess_word not in tested_words and guess_word not in sim_dict:
            tested_words.append(guess_word)
            return guess_word
    # Should never be reached
    raise ValueError('no word found')

# Get the closest/best candidate word to try
def _guess_da_magic_word(tried_word, cosine_distance):
    tmp_dict = {}
    epsilon = 1e-4 # With our models, this is big enough :)
    lower_boundary = cosine_distance - epsilon
    upper_boundary = cosine_distance + epsilon
    for word in model.index_to_key:
         sim = model.similarity(word, tried_word)
         if lower_boundary <= sim <= upper_boundary:
            tmp_dict[word] = abs(cosine_distance - sim) # store the delta to sort the map
    sorted_dict = dict(sorted(tmp_dict.items(), key=lambda x: x[1], reverse=False))
    guess_words.append(sorted_dict)
    # Returns the closest untested word
    for w in sorted_dict:
        if w not in tested_words:
            return w
    return ''

def _mean_value(word):
    ret = 0.0
    n = 0
    for sublist in guess_words:
        for w in sublist:
            if w == word:
                ret += sublist[w]
                n += 1
    return ret / n


# Get the most frequent word appearing close to the solution
def _best_most_frequent_word():
    word_counts = {}
    max_occurrence = 0
    # Create the frequency map and get the max occurrence of any word
    for sublist in guess_words:
        for w in sublist:
            word_counts[w] = word_counts.get(w, 0) + 1
            if word_counts[w] > max_occurrence:
                max_occurrence = word_counts[w]
    # For the candidates appearing the most, return the closest one
    delta = 31337
    ret = ''
    for sublist in guess_words:
        for w in sublist:
            if word_counts[w] == max_occurrence and w not in tested_words:
                meanv = _mean_value(w)
                if delta > meanv:
                    delta = meanv
                    ret = w
    return ret

def master_guesser():
    # 1. First word: totally random as not detectable + user can try anything
    # O(1)
    if len(sim_dict) == 0:
        ret = model.index_to_key[secrets.randbelow(len(model))]
    # 2. Try the closest call given the cosine distance the server/oracle gives
    # O(n)
    elif len(sim_dict) == 1:
        w = next(iter(sim_dict))
        tested_words.append(w)
        ret = _guess_da_magic_word(w, sim_dict[w])
    # 3. Try the most appearing and closest word for each candidates
	# O(n*tested_words)
    else:
        # As time to solve is proportional to the tried words, limit them to 2
        cut_sim_dict = dict(list(sim_dict.items())[:2])
        # Update our map of the closest/best candidates
        for w in cut_sim_dict:
            if w not in tested_words:
                tested_words.append(w)
                _guess_da_magic_word(w, cut_sim_dict[w])
        # Most frequent word in the candidates
        ret = _best_most_frequent_word()
    # This should not happen but.. just in case our chosen epsilon was too small
    # O(n)
    if ret == '':
        return _next_word_to_try()
    return ret
`);
        console.timeEnd('loadPythonModel: load downloaded model (~3s)');
        delete(document.head.contents);
        console.timeEnd('loadPythonModel total (~6s)');
        // Share Similarities map which contains the submitted words
        pyodide.globals.set('similarities', similarities);
        document.getElementById("button3").innerHTML = jokerStr;
        document.getElementById("button3").addEventListener("click", () => {
            toggleButton();
        });
    }

    // Add a 'Joker!' button if needed
    async function addButton() {
        const cemant_form = 'form';
        if (document.getElementById(cemant_form) === null) {
            return;
        }
        // only add the button if the word of the day has not yet been found
        if (localStorage.secret === undefined) {
            // Add the CSS for the 'Joker!' button
            const style = document.createElement("style");
            style.innerHTML = '#button3{position:relative;padding:8px 16px;color-scheme:dark;border:none;outline:none;border-radius:2px;cursor:pointer;float:left}#button3:active{background:red}.button__text{font:bold 20px san-serif;transition:all 0.2s}.button--loading .button__text{opacity:0.4}.button--loading::after{content:"";position:absolute;width:16px;height:16px;top:0;left:0;right:0;bottom:0;margin:auto;border:4px solid transparent;border-top-color:#ffffff;border-radius:50%;animation:button-loading-spinner 1s ease infinite}@keyframes button-loading-spinner{from{transform:rotate(0turn)}to{transform:rotate(1turn)}}'
            document.getElementsByTagName("head")[0].appendChild(style);
            // Add the HTML code for the button
            document.getElementById(cemant_form).insertAdjacentHTML('beforebegin', '<button id="button3">' + waitStr + '</button>');
            await loadPythonModel();
        }
    }

    // Inject a remote javascript into the webpage then call the given function
    function injectScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = function(){
            callback();
        }
        document.head.appendChild(script);
    }
})();