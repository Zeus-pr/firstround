"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type PileProps = {
  progressRef: React.RefObject<number>;
};

const COUNT = 36;
const KEPT = 16;

function applicationTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1360;
  const draw = canvas.getContext("2d");
  if (!draw) return null;
  draw.fillStyle = "#f4efe6";
  draw.fillRect(0, 0, canvas.width, canvas.height);
  draw.fillStyle = "#1c1916";
  draw.fillRect(88, 112, 360, 28);
  draw.fillStyle = "#5c564e";
  for (let i = 0; i < 8; i += 1) {
    draw.fillRect(88, 230 + i * 112, i % 3 === 2 ? 480 : 820, 14);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function Pile({ progressRef }: PileProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x171614, 1);
    renderer.sortObjects = false;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    camera.position.set(0, 0.2, 8.2);
    camera.lookAt(0, 0, 0);

    const texture = applicationTexture();
    const geometry = new THREE.PlaneGeometry(1.05, 1.4);
    const cards: THREE.Mesh[] = [];

    for (let index = 0; index < COUNT; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        depthWrite: true,
        depthTest: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const column = index % 6;
      const row = Math.floor(index / 6);
      mesh.userData.home = {
        x: (column - 2.5) * 1.55,
        y: (2 - row) * 1.85,
        z: -row * 0.08 - column * 0.012,
      };
      mesh.renderOrder = index;
      scene.add(mesh);
      cards.push(mesh);
    }

    const seal = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 20),
      new THREE.MeshBasicMaterial({ color: 0x9d3b28 }),
    );
    cards[KEPT].add(seal);
    seal.position.set(-0.32, 0.5, 0.02);

    const draw = () => {
      const progress = progressRef.current ?? 0;
      cards.forEach((mesh, index) => {
        const home = mesh.userData.home as { x: number; y: number; z: number };
        const kept = index === KEPT;
        if (kept) {
          mesh.position.x = home.x * (1 - progress) + 0.95 * progress;
          mesh.position.y = home.y * (1 - progress) + 0.2 * progress;
          mesh.position.z = 0.35;
          mesh.rotation.z = 0;
          mesh.visible = true;
          return;
        }
        const awayX = home.x === 0 ? (index % 2 === 0 ? 1 : -1) : Math.sign(home.x);
        mesh.position.x = home.x + awayX * progress * 3.2;
        mesh.position.y = home.y - progress * 2.4;
        mesh.position.z = -0.6 - index * 0.02;
        mesh.rotation.z = awayX * progress * 0.05;
        mesh.visible = progress < 0.92;
      });
      renderer.render(scene, camera);
    };

    const fit = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width < 2 || height < 2) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      draw();
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(mount);
    let visible = true;
    let raf = 0;
    const tick = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    seen.observe(mount);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      observer.disconnect();
      geometry.dispose();
      texture?.dispose();
      seal.geometry.dispose();
      (seal.material as THREE.Material).dispose();
      cards.forEach((mesh) => (mesh.material as THREE.Material).dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [progressRef]);

  return <div className="pile" ref={mountRef} aria-hidden="true" />;
}
