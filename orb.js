// orb.js
window.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('orb-3d');
  const width = 340, height = 340;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // --- BLOOM и POSTPROCESSING ---
  let composer;
  let bloomPass;

  function initPostprocessing() {
    composer = new THREE.EffectComposer(renderer);
    const renderScene = new THREE.RenderPass(scene, camera);
    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.85,
      0.8,
      0.7
    );
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
  }

  // --- Динамический шум для искажения поверхности ---
  // Используем SimplexNoise (глобально доступен через CDN)
  const simplex = new SimplexNoise();

  // Центральный шар
  const geometry = new THREE.SphereGeometry(55, 64, 64); // увеличил сегменты для плавности
  const material = new THREE.MeshPhongMaterial({
    color: 0x25F4EE,
    shininess: 80,
    specular: 0xFFFFFF,
    emissive: 0x25F4EE,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.97
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // --- Двойной шар ---
  const innerGeometry = new THREE.SphereGeometry(38, 40, 40);
  const innerMaterial = new THREE.MeshPhongMaterial({
    color: 0xFE2C55,
    specular: 0xFFFFFF,
    emissive: 0xFE2C55,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.65
  });
  const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
  sphere.add(innerSphere);

  // Свет
  const light = new THREE.PointLight(0x25F4EE, 1.2, 400);
  light.position.set(30, 80, 100);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x181c23, 0.8));

  let colorPhase = 0;
  let pulsePhase = 0;

  // --- Частицы ---
  const particles = [];
  const particleCount = 48;
  for (let i = 0; i < particleCount; i++) {
    const particleSize = 1 + Math.random() * 2;
    const pg = new THREE.SphereGeometry(particleSize, 10, 10);
    const pm = new THREE.MeshPhongMaterial({
      color: Math.random() > 0.5 ? 0x25F4EE : 0xFE2C55, // случайно бирюзовый или красный
      shininess: 120,
      emissive: Math.random() > 0.5 ? 0x25F4EE : 0xFE2C55,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85
    });
    const p = new THREE.Mesh(pg, pm);
    scene.add(p);
    particles.push({
      mesh: p,
      angle: Math.random() * Math.PI * 2,
      radius: 70 + Math.random() * 7,
      speed: 0.008 + Math.random() * 0.004,
      yOffset: (Math.random() - 0.5) * 70,
      phase: Math.random() * Math.PI * 2 // для плавного мерцания
    });
  }

  camera.position.z = 200;

  THREE.EffectComposer = window.THREE.EffectComposer || THREE.EffectComposer;
  THREE.RenderPass = window.THREE.RenderPass || THREE.RenderPass;
  THREE.UnrealBloomPass = window.THREE.UnrealBloomPass || THREE.UnrealBloomPass;

  // --- Сохраняем оригинальные позиции вершин для деформации ---
  const basePositions = geometry.attributes.position.array.slice();

  // --- LIVE STATS UPDATE ---
  let previousTotalLikes = null;
  let previousTotalMiners = null;
  let initialStatsLoaded = false;

  // Функция для создания анимации добавления токенов
  function showTokenAddedAnimation(element, amount) {
    if (!amount || amount <= 0) return;

    const tokenAdded = document.createElement('div');
    tokenAdded.className = 'token-added';
    tokenAdded.textContent = '+' + amount.toLocaleString();

    // Случайное смещение по горизонтали
    const randomX = Math.random() * 40 - 20; // от -20px до +20px
    tokenAdded.style.left = `calc(50% + ${randomX}px)`;

    element.appendChild(tokenAdded);

    // Удаляем элемент после завершения анимации
    setTimeout(() => {
      if (tokenAdded.parentNode === element) {
        element.removeChild(tokenAdded);
      }
    }, 2000);
  }

  // Добавляем обработчики кликов для тестирования анимации
  setTimeout(() => {
    const minedElement = document.querySelector('.stat-card .stat-value');
    if (minedElement) {
      minedElement.addEventListener('click', () => {
        const randomAmount = Math.floor(Math.random() * 10000) + 100;
        showTokenAddedAnimation(minedElement, randomAmount);
      });
    }
  }, 1000);

  async function updateStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();

      // TOKENS MINED
      const mined = document.querySelector('.stat-card .stat-value');
      if (mined) {
        const newTotalLikes = data.totalLikes;
        let diff = 0;
        if (previousTotalLikes !== null) {
          diff = newTotalLikes - previousTotalLikes;
        }
        // Показываем анимацию только если это не первый апдейт
        if (initialStatsLoaded && diff > 0) {
          showTokenAddedAnimation(mined, diff);
        }
        // Удаляем только текстовые узлы, не трогая .token-added
        Array.from(mined.childNodes).forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) node.remove();
        });
        mined.insertBefore(document.createTextNode(newTotalLikes.toLocaleString()), mined.firstChild);
        previousTotalLikes = newTotalLikes;
      }

      // TOTAL MINERS
      const miners = document.querySelectorAll('.stat-card .stat-value')[1];
      if (miners) {
        const newTotalMiners = data.totalMiners;
        let diff = 0;
        if (previousTotalMiners !== null) {
          diff = newTotalMiners - previousTotalMiners;
        }
        if (initialStatsLoaded && diff > 0) {
          showTokenAddedAnimation(miners, diff);
        }
        Array.from(miners.childNodes).forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) node.remove();
        });
        miners.insertBefore(document.createTextNode(newTotalMiners.toLocaleString()), miners.firstChild);
        previousTotalMiners = newTotalMiners;
      }
      initialStatsLoaded = true;
      // LEADERBOARD
      const lbList = document.querySelector('.leaderboard-list');
      if (lbList) {
        lbList.innerHTML = '';
        // Рендерим существующих пользователей
        data.leaderboard.forEach((u, i) => {
          const row = document.createElement('div');
          row.className = 'leaderboard-row';
          row.innerHTML = `
            <span>${i+1}</span>
            <span style="display:flex;align-items:center;gap:8px;">
              <img src="${u.avatar}" alt="avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;background:#222;margin-right:4px;">
              <span>${u.nickname}</span>
            </span>
            <span>${u.likes.toLocaleString()}</span>
          `;
          lbList.appendChild(row);
        });
        // Добавляем пустые строки-заполнители
        for (let i = data.leaderboard.length; i < 5; i++) {
          const row = document.createElement('div');
          row.className = 'leaderboard-row';
          row.innerHTML = `
            <span>${i+1}</span>
            <span style="display:flex;align-items:center;gap:8px;">
              <img src="" alt="avatar" style="width:28px;height:28px;border-radius:50%;background:#222;opacity:0.18;margin-right:4px;">
              <span style="opacity:0.35;">—</span>
            </span>
            <span style="opacity:0.35;">—</span>
          `;
          lbList.appendChild(row);
        }
      }
    } catch(e) {
      // ignore
    }
  }
  setInterval(updateStats, 2000);
  updateStats();


  function animate() {
    requestAnimationFrame(animate);

    // --- Динамическое искажение поверхности шара ---
    const pos = geometry.attributes.position;
    const time = performance.now() * 0.0007;
    for (let i = 0; i < pos.count; i++) {
      // Получаем исходную позицию
      const ix = i * 3;
      const x0 = basePositions[ix];
      const y0 = basePositions[ix + 1];
      const z0 = basePositions[ix + 2];
      // Рассчитываем радиус и нормаль
      const r0 = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0);
      const nx = x0 / r0;
      const ny = y0 / r0;
      const nz = z0 / r0;
      // Шумовое искажение
      const noise = simplex.noise4D(nx * 2.2, ny * 4.2, nz * 2.2, time) * 7.3;
      const r = r0 + noise;
      pos.array[ix] = nx * r;
      pos.array[ix + 1] = ny * r;
      pos.array[ix + 2] = nz * r;
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    // Плавная смена цвета шара между бирюзовым TikTok и красным TikTok
    colorPhase += 0.008;
    const t = (Math.sin(colorPhase) * 0.5 + 0.5); // 0 до 1

    // Бирюзовый #25F4EE (37, 244, 238) -> Красный #FE2C55 (254, 44, 85)
    const r = 37 * (1-t) + 254 * t;
    const g = 244 * (1-t) + 44 * t;
    const b = 238 * (1-t) + 85 * t;

    material.color.setRGB(r/255, g/255, b/255);
    material.emissive.setRGB(r/255 * 0.3, g/255 * 0.3, b/255 * 0.3);

    // Внутренний шар имеет инвертированные цвета
    innerMaterial.color.setRGB((254-r)/255, (244-g)/255, (238-b)/255);
    innerMaterial.emissive.setRGB((254-r)/255 * 0.4, (244-g)/255 * 0.4, (238-b)/255 * 0.4);

    // Свет тоже меняет цвет
    light.color.setRGB(r/255, g/255, b/255);

    // Пульсация
    pulsePhase += 0.018;
    const scale = 1 + 0.04 * Math.sin(pulsePhase);
    sphere.scale.set(scale, scale, scale);

    // Вращение по двум осям
    sphere.rotation.y += 0.003;
    sphere.rotation.x = 0.15 * Math.sin(pulsePhase * 0.6);

    // Частицы
    particles.forEach(pt => {
      pt.angle += pt.speed;
      pt.mesh.position.x = Math.cos(pt.angle) * pt.radius;
      pt.mesh.position.z = Math.sin(pt.angle) * pt.radius;
      pt.mesh.position.y = pt.yOffset;
      // Плавное "дыхание" opacity и glow
      pt.phase += 0.012 + pt.speed * 0.7;
      const pulse = 0.75 + 0.15 * Math.sin(pt.phase);
      pt.mesh.material.opacity = pulse;
      pt.mesh.material.emissive.setRGB(0.4 + 0.6 * pulse, 0.7 + 0.3 * pulse, 1.0);
    });

    // Рендер с bloom если доступен
    if (composer && bloomPass) {
      bloomPass.strength = 1.18;
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
  }

  if (typeof THREE.UnrealBloomPass !== 'undefined') {
    initPostprocessing();
  }

  animate();
});
