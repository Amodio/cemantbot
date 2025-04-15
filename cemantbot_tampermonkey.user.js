// ==UserScript==
// @name         Cemantix/Cemantle bot
// @namespace    https://github.com/Amodio
// @version      2025-04-15
// @description  Bot for Cemantix/Cemantle word games
// @author       Amodio
// @match        https://cemantix.certitudes.org
// @match        https://cemantle.certitudes.org
// @icon         https://www.google.com/s2/favicons?sz=64&domain=certitudes.org
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    //'use strict';

    // Bypass a fix the author made to return mocked scores if the stack (number of functions called) is different than normal: r = Error().stack; r && 4 < r.split("\n").length
    Object.defineProperty(Error, "stackTraceLimit", {
        value: 3,
        writable: false,
        configurable: false
    });

    var pyodide;
    async function getWord() {
        var positiveWords = [];
        var negativeWords = [];
        const data = JSON.parse(localStorage.getItem("guesses"));
        if (data != null) {
            const tmp = Object.keys(data).map(function(key) {
                return [key, data[key]];
            }).sort((a, b) => b[1][1][0] - a[1][1][0]);
            if (tmp) {
                let meanPos = 0.0;
                let tmpArray = [];
                for (let i = 0; i < tmp.length; i++) {
                    if (tmp[i][1][1][1]) {
                        tmpArray.push(tmp[i][1][1][1]);
                    }
                }
                let meanNeg = 18.0;
                if (tmpArray.length > 5){
                    meanPos = myMeanCalc(tmpArray);
                } else {
                    tmpArray = [];
                    for (let i = 0; i < tmp.length; i++) {
                        if (tmp[i][1][1][1] == null) {
                            tmpArray.push(tmp[i][1][1][0]);
                        }
                    }
                    meanNeg = myMeanCalc(tmpArray);
                }
                for (let i = 0; i < tmp.length; i++) {
                    if (tmp[i][1][1][1] == null && tmp[i][1][1][0] <= meanNeg) {
                        if (negativeWords.indexOf(tmp[i][0]) == -1) {
                            negativeWords.push(tmp[i][0]);
                        }
                    } else if (tmp[i][1][1][1] && tmp[i][1][1][1] > meanPos) {
                        if (positiveWords.indexOf(tmp[i][0]) == -1) {
                            positiveWords.push(tmp[i][0]);
                        }
                    }
                }
                negativeWords = negativeWords.reverse();
                // Cap to 50 positive&negative words max
                negativeWords = negativeWords.slice(0, 50);
                positiveWords = positiveWords.slice(0, 50);
            }
        }
        pyodide.globals.set('positiveWords', positiveWords);
        pyodide.globals.set('negativeWords', negativeWords);
        var ret = await pyodide.runPython(`
pWords = positiveWords.to_py()
nWords = negativeWords.to_py()
client_data = str(pWords) + '_' + str(nWords)
if prev_client_data == client_data:
    wordIndex += 1
else:
    wordIndex = 1
    prev_client_data = client_data
if wordIndex <= 0:
    wordIndex = 1
response_data = ''
SHIFT=256
while True:
    if len(pWords) == 0 and len(nWords) == 0:
        response_data = model.index_to_key[1337 + wordIndex - 1]
    else:
        mostSimMod = model.most_similar(positive=pWords, negative=nWords, topn=wordIndex+SHIFT-1)
        for i in range(SHIFT):
            response_data = mostSimMod[wordIndex - 1][0]
            wordIndex += 1
            if response_data and response_data not in sentWords:
                break
    if response_data and response_data not in sentWords:
        sentWords.append(response_data)
        break
    else:
        wordIndex += SHIFT
response_data
`);
        delete(positiveWords);
        delete(negativeWords);
        return ret;
    }
    const processingStr = '<span class="button__text">Processing...</span>';
    const waitStr = '<span class="button__text">Loading...</span>';
    const waitStr2 = '<span class="button__text">Please wait...</span>';
    const jokerStr = '<span class="button__text">&nbsp;&nbsp;&nbsp; Joker!&nbsp;&nbsp;&nbsp;</span>';
    function myMeanCalc(arr) {
        return arr.reduce((acc, val) => acc + val, 0) / arr.length;
    }
    const myTimeout = 30;
    function sleep(delay) {
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    async function loadPythonModel() {
        console.time('loadPythonModel total (~6s)');
        console.time('loadPythonModel: load gensim pkg with Pyodide (~3s)');
        pyodide = await window.loadPyodide();
        await pyodide.loadPackage('gensim');
        console.timeEnd('loadPythonModel: load gensim pkg with Pyodide (~3s)');
        console.time('loadPythonModel: download');
        const fetchUrl = (window.location.hostname.split('.')[0] == 'cemantix' ? 'https://media.githubusercontent.com/media/Amodio/cemantix/main/models/frWac_no_postag_phrase_500_cbow_cut10_stripped.bin' : 'https://raw.githubusercontent.com/Amodio/cemantix/main/CEMANTLE/models/GoogleNews-vectors-negative300_stripped.bin');
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
import js
from gensim.models import KeyedVectors

model_name = '/model.bin'
with open(model_name, 'wb') as fh:
    js.document.head.contents.to_file(fh)

model = KeyedVectors.load_word2vec_format(model_name, binary=True, unicode_errors='ignore')
prev_client_data = ''
sentWords = []
`);
        console.timeEnd('loadPythonModel: load downloaded model (~3s)');
        delete(document.head.contents);
        console.timeEnd('loadPythonModel total (~6s)');
        document.getElementById("button3").innerHTML = jokerStr;
        document.getElementById("button3").addEventListener("click", () => {
            toggleButton();
        });
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
    async function jokerTime() {
        while (document.getElementById("button3").innerHTML == processingStr) {
            //console.time('getWord');
            var output = await getWord();
            //console.timeEnd('getWord');
            //console.time('tryWord');
            await tryWord(output);
            delete(output);
            //console.timeEnd('tryWord');
        }
    }
    function toggleButton() {
        const element = document.getElementById("button3");
        if (element.innerHTML == jokerStr) {
            element.innerHTML = processingStr;
            //console.time('joker');
            startTime = Date.now();
            jokerTime();
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
    function injectScript(src, callback) {
        var script = document.createElement('script');
        script.src = src;
        script.onload=function(){
            callback();
        }
        document.head.appendChild(script);
    }
    function injectCSS() {
        const style = document.createElement("style");
        style.innerHTML = '#button3{position:relative;padding:8px 16px;color-scheme:dark;border:none;outline:none;border-radius:2px;cursor:pointer;float:left}#button3:active{background:red}.button__text{font:bold 20px san-serif;transition:all 0.2s}.button--loading .button__text{opacity:0.4}.button--loading::after{content:"";position:absolute;width:16px;height:16px;top:0;left:0;right:0;bottom:0;margin:auto;border:4px solid transparent;border-top-color:#ffffff;border-radius:50%;animation:button-loading-spinner 1s ease infinite}@keyframes button-loading-spinner{from{transform:rotate(0turn)}to{transform:rotate(1turn)}}'
        document.getElementsByTagName("head")[0].appendChild(style);
    }
    async function addButton() {
        const cemant_form = 'form';
        if (document.getElementById(cemant_form) === null) {
            return;
        }
        if (localStorage.secret !== undefined) {
            // do not add the button if the word of the day has already been found
        } else {
            injectCSS();
            document.getElementById(cemant_form).insertAdjacentHTML('beforebegin', '<button id="button3">' + waitStr + '</button>');
            await loadPythonModel();
        }
    }
    var startTime = 0;
    var durationTime = 0;
    injectScript('https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js', addButton);
})();
