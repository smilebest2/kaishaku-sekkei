(() => {
    const storageKey = "kaishakuIntroSeen";
    const overlay = document.querySelector("[data-intro-overlay]");
    const canvas = document.querySelector("[data-intro-canvas]");
    const flash = document.querySelector("[data-intro-flash]");
    const maverick = document.querySelector("[data-intro-maverick]");
    const title = document.querySelector("[data-intro-title]");
    const skip = document.querySelector("[data-intro-skip]");

    if (!overlay || !canvas || !flash || !maverick || !title || !skip) {
        return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shouldReplay = new URLSearchParams(window.location.search).has("intro");
    const hasSeen = localStorage.getItem(storageKey) === "true";

    if (reduceMotion || (hasSeen && !shouldReplay)) {
        overlay.remove();
        if (reduceMotion) {
            localStorage.setItem(storageKey, "true");
        }
        return;
    }

    const ctx = canvas.getContext("2d");
    const wall = new Image();
    const pieces = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startTime = 0;
    let rafId = 0;
    let finished = false;

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function coverRect(imgWidth, imgHeight) {
        const scale = Math.max(width / imgWidth, height / imgHeight);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        return {
            x: (width - drawWidth) / 2,
            y: (height - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight,
            scale
        };
    }

    function buildPieces() {
        pieces.length = 0;
        const isMobile = width < 700;
        const cols = isMobile ? 7 : 10;
        const rows = isMobile ? 5 : 7;
        const sourceWidth = wall.naturalWidth / cols;
        const sourceHeight = wall.naturalHeight / rows;
        const rect = coverRect(wall.naturalWidth, wall.naturalHeight);
        const centerX = width / 2;
        const centerY = height / 2;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const drawWidth = sourceWidth * rect.scale;
                const drawHeight = sourceHeight * rect.scale;
                const x = rect.x + col * drawWidth;
                const y = rect.y + row * drawHeight;
                const pieceCenterX = x + drawWidth / 2;
                const pieceCenterY = y + drawHeight / 2;
                const angle = Math.atan2(pieceCenterY - centerY, pieceCenterX - centerX);
                const distance = Math.hypot(pieceCenterX - centerX, pieceCenterY - centerY);
                const blast = Math.max(0, 1 - distance / Math.hypot(width / 2, height / 2));
                const speed = 520 + blast * 780 + Math.random() * 260;

                pieces.push({
                    sx: col * sourceWidth,
                    sy: row * sourceHeight,
                    sw: sourceWidth,
                    sh: sourceHeight,
                    x,
                    y,
                    w: drawWidth,
                    h: drawHeight,
                    vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 180,
                    vy: Math.sin(angle) * speed - 120 - Math.random() * 180,
                    rotation: (Math.random() - 0.5) * 0.35,
                    spin: (Math.random() - 0.5) * 5.8,
                    delay: Math.max(0, distance / 1800 - blast * 0.07)
                });
            }
        }
    }

    function drawWall() {
        const rect = coverRect(wall.naturalWidth, wall.naturalHeight);
        ctx.drawImage(wall, rect.x, rect.y, rect.width, rect.height);
    }

    function drawPieces(seconds) {
        const gravity = 720;
        for (const piece of pieces) {
            const t = Math.max(0, seconds - piece.delay);
            if (t === 0) {
                ctx.drawImage(wall, piece.sx, piece.sy, piece.sw, piece.sh, piece.x, piece.y, piece.w, piece.h);
                continue;
            }

            const ease = Math.min(t / 0.5, 1);
            const x = piece.x + piece.vx * t;
            const y = piece.y + piece.vy * t + gravity * t * t * 0.5;
            const rotation = piece.rotation + piece.spin * t;

            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1.1) / 0.65);
            ctx.translate(x + piece.w / 2, y + piece.h / 2);
            ctx.rotate(rotation);
            ctx.scale(1 + ease * 0.03, 1 + ease * 0.03);
            ctx.drawImage(wall, piece.sx, piece.sy, piece.sw, piece.sh, -piece.w / 2, -piece.h / 2, piece.w, piece.h);
            ctx.restore();
        }
    }

    function finishIntro() {
        if (finished) {
            return;
        }

        finished = true;
        cancelAnimationFrame(rafId);
        localStorage.setItem(storageKey, "true");
        overlay.classList.add("is-hidden");
        window.setTimeout(() => overlay.remove(), 460);
    }

    function loadImageElement(image) {
        if (image.complete && image.naturalWidth > 0) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", reject, { once: true });
        });
    }

    function prepareMaverickCutout() {
        try {
            const source = document.createElement("canvas");
            const sourceContext = source.getContext("2d");
            const imageWidth = maverick.naturalWidth;
            const imageHeight = maverick.naturalHeight;
            const visited = new Uint8Array(imageWidth * imageHeight);
            const queue = [];

            source.width = imageWidth;
            source.height = imageHeight;
            sourceContext.drawImage(maverick, 0, 0);

            const imageData = sourceContext.getImageData(0, 0, imageWidth, imageHeight);
            const data = imageData.data;

            function isBackgroundPixel(index) {
                const offset = index * 4;
                const red = data[offset];
                const green = data[offset + 1];
                const blue = data[offset + 2];
                const max = Math.max(red, green, blue);
                const min = Math.min(red, green, blue);
                return max > 228 && max - min < 28;
            }

            function push(index) {
                if (visited[index] || !isBackgroundPixel(index)) {
                    return;
                }
                visited[index] = 1;
                queue.push(index);
            }

            for (let x = 0; x < imageWidth; x++) {
                push(x);
                push((imageHeight - 1) * imageWidth + x);
            }

            for (let y = 0; y < imageHeight; y++) {
                push(y * imageWidth);
                push(y * imageWidth + imageWidth - 1);
            }

            for (let cursor = 0; cursor < queue.length; cursor++) {
                const index = queue[cursor];
                const x = index % imageWidth;
                const y = Math.floor(index / imageWidth);
                const offset = index * 4;
                data[offset + 3] = 0;

                if (x > 0) push(index - 1);
                if (x < imageWidth - 1) push(index + 1);
                if (y > 0) push(index - imageWidth);
                if (y < imageHeight - 1) push(index + imageWidth);
            }

            sourceContext.putImageData(imageData, 0, 0);
            maverick.src = source.toDataURL("image/png");
        } catch (_error) {
            // Local file previews can block pixel reads; keep the original image and continue.
        }
    }

    function animate(now) {
        if (!startTime) {
            startTime = now;
            flash.classList.add("is-active");
        }

        const seconds = (now - startTime) / 1000;
        ctx.clearRect(0, 0, width, height);

        const shake = seconds < 0.48 ? (1 - seconds / 0.48) * 13 : 0;
        ctx.save();
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        if (seconds < 0.16) {
            drawWall();
        } else {
            drawPieces(seconds - 0.16);
        }
        ctx.restore();

        if (seconds > 0.72) {
            maverick.classList.add("is-active");
        }

        if (seconds > 1.35) {
            title.classList.add("is-active");
        }

        if (seconds > 2.72) {
            finishIntro();
            return;
        }

        rafId = requestAnimationFrame(animate);
    }

    skip.addEventListener("click", finishIntro);
    window.addEventListener("resize", () => {
        resizeCanvas();
        buildPieces();
    }, { passive: true });

    Promise.all([
        new Promise((resolve, reject) => {
            wall.onload = resolve;
            wall.onerror = reject;
            wall.src = "images/top_anime/intro-wall.png";
        }),
        loadImageElement(maverick)
    ]).then(() => {
        resizeCanvas();
        buildPieces();
        prepareMaverickCutout();
        requestAnimationFrame(animate);
    }).catch(finishIntro);
})();
