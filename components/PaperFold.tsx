"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type PaperFoldProps = {
  progressRef: React.RefObject<number>;
};

export function PaperFold({ progressRef }: PaperFoldProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    mount.appendChild(renderer.domElement);

    renderer.setClearColor(0x171614, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 1.15, 4.6);
    camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
    key.position.set(1.6, 2.8, 2.4);
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xc8bbaa, 0.7));

    const material = new THREE.MeshStandardMaterial({
      color: 0xf4efe6,
      roughness: 0.86,
      metalness: 0,
    });
    const upperGeo = new THREE.BoxGeometry(1.7, 1.05, 0.035);
    const lowerGeo = new THREE.BoxGeometry(1.7, 1.05, 0.035);
    const upper = new THREE.Mesh(upperGeo, material);
    upper.position.y = 0.525;
    const lower = new THREE.Mesh(lowerGeo, material);
    lower.position.y = -0.525;
    const hinge = new THREE.Group();
    hinge.add(lower);
    const root = new THREE.Group();
    root.add(upper);
    root.add(hinge);
    root.rotation.x = -0.62;
    root.rotation.z = -0.08;
    scene.add(root);

    const draw = () => {
      const progress = progressRef.current ?? 0;
      hinge.rotation.x = -progress * 1.35;
      root.position.y = progress * 0.22;
      root.rotation.y = -0.25 + progress * 0.45;
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
    let last = -1;
    let visible = true;
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    seen.observe(mount);
    const timer = window.setInterval(() => {
      const progress = progressRef.current ?? 0;
      if (!visible || progress === last) return;
      last = progress;
      draw();
    }, 1000 / 30);

    return () => {
      window.clearInterval(timer);
      seen.disconnect();
      observer.disconnect();
      upperGeo.dispose();
      lowerGeo.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [progressRef]);

  return <div className="fold" ref={mountRef} aria-hidden="true" />;
}
