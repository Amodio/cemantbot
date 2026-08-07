

# cemantbot
Bot para un juego web donde tienes que adivinar una palabra cada día (FR + EN).

## Instalación
1) Para Chrome, activa el [modo de desarrollador](https://www.tampermonkey.net/faq.php#Q209) e instala la [extensión Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo); para Firefox, instala [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
2) Haz clic en el [userscript de cemantbot](https://github.com/Amodio/cemantbot/raw/refs/heads/main/cemantbot_tampermonkey.user.js) e instálalo. Si TamperMonkey no se abre, pega la URL anterior en: `Dashboard > Utilities > Import from an URL`.

Si eres paranoico en Chrome, puedes restringir el acceso de TamperMonkey solo a: `https://*.certitudes.org/*` y `https://raw.githubusercontent.com/*`.

## Uso
* Ve a https://cemantix.certitudes.org o https://cemantle.certitudes.org
* Asegúrate de que el botón 'Joker!' esté cargado, de lo contrario actualiza la página (toma ~6 seg en cargar por completo, más al principio para almacenar en caché el modelo binario).
* Haz clic en el botón 'Joker!', ¡disfrútalo!

![Botón Joker](https://raw.githubusercontent.com/Amodio/cemantbot/main/images/joker_btn.png "Joker button")

![Primero](https://raw.githubusercontent.com/Amodio/cemantbot/main/images/1st_17attempts.png "First")

![Cemantle en 6 intentos](https://raw.githubusercontent.com/Amodio/cemantbot/main/CEMANTLE/images/cemantle_6_attempts.png "Cemantle in 6 attempts")

## Descripción
El algoritmo principal ahora está drásticamente mejorado: debería **encontrar la palabra secreta en 3 intentos/palabras y en menos de 5 segundos** :)

El script independiente encuentra respuestas en **menos de un segundo**.
Puedes probar las dos primeras palabras tú mismo o dejar que el bot elija (la primera palabra es aleatoria).

Básicamente, calcula por fuerza bruta la distancia coseno (temperatura) para cada palabra probada y selecciona el candidato más cercano.

El algoritmo de respaldo (que en realidad nunca debería alcanzarse) utiliza puntuaciones de producto punto (producto escalar) para converger hacia la incrustación vectorial v de la palabra secreta mediante:
1. armar un pequeño sistema lineal con vectores de palabras de consulta conocidos (b<sub>i</sub> =⟨v,w<sub>i</sub>⟩ donde w<sub>i</sub> son las distancias Word2Vec conocidas a la palabra secreta),
2. resolver para v la solución de mínimos cuadrados que minimiza ‖A v − b‖₂,
3. encontrar el vecino más cercano para v en el modelo Gensim/word2vec y probarlo,
4. reiniciar hasta que se encuentre la palabra secreta.

## Explicación (en inglés)
El algoritmo principal ahora utiliza la similitud coseno (temperatura en el juego) en un modelo [Word2Vec](https://en.wikipedia.org/wiki/Word2vec) (reducido) (vectores normalizados).

Selecciona cáscaras coseno finas (= rebanadas hipersféricas) en el espacio de incrustación, que son palabras (representadas por vectores) cercanas a la que buscamos (incluyéndola), para probarlas.
Cada intento intersecta esas cáscaras (hiperplanos) hasta encontrar la palabra secreta (vector objetivo). La primera palabra es aleatoria.

Así que, para ponerlo simplemente, el algoritmo principal implementa un ataque de inversión de espacio de similitud coseno.

## Script independiente
```
git clone https://github.com/Amodio/cemantbot.git
cd cemantbot/
pip3 install aiohttp gensim numpy --break-system-packages # (o usa python -m venv cemantbot)
python3 ./cemantbot.py # agrega cualquier argumento para resolver Cemantle en lugar de Cémantix
```

## Notas
Modelos de [Jean-Philippe Fauconnier](https://fauconnier.github.io) y [Google](https://code.google.com/archive/p/word2vec/) (para Cemantle).

He probado _55402_ palabras válidas en Cémantix (incluso si algunas no existen en francés); _46212_ para Cemantle.
Hay una coincidencia del 100% entre el modelo que reduje de Google y el utilizado por Cemantle; 97% para Cémantix (ya que los acentos eran un problema aparentemente).

El autor ha añadido protecciones del lado del cliente para inutilizar este bot (tiempos de respuesta sospechosos), por lo que ahora hay una versión independiente del bot (por si se agregan más protecciones del lado del cliente).

¡Gracias a [vivien7806](https://github.com/vivien7806 "vivien7806") por la gran ayuda!
