"use client";

import { useEffect, useRef } from "react";

interface MoodBackgroundProps {
  mood: string;
  children: React.ReactNode;
}

export default function MoodBackground({ mood, children }: MoodBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 440;
    canvas.height = 600;

    let animationId: number;
    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      switch (mood) {
        case "mystical":
          drawMystical(ctx, canvas.width, canvas.height, frame);
          break;
        case "dark":
          drawDark(ctx, canvas.width, canvas.height, frame);
          break;
        case "zen":
          drawZen(ctx, canvas.width, canvas.height, frame);
          break;
        case "wonder":
          drawWonder(ctx, canvas.width, canvas.height, frame);
          break;
        case "horror":
          drawHorror(ctx, canvas.width, canvas.height, frame);
          break;
        case "confused":
          drawConfused(ctx, canvas.width, canvas.height, frame);
          break;
        default:
          drawMystical(ctx, canvas.width, canvas.height, frame);
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [mood]);

  return (
    <div className="relative w-full max-w-[440px] rounded-2xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ============================================================
// MYSTICAL — Stars + Moon + Water
// ============================================================
function drawMystical(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0a0a1a");
  grad.addColorStop(0.35, "#1a0a2e");
  grad.addColorStop(0.7, "#0d1a30");
  grad.addColorStop(1, "#0a0a1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  const stars = [
    { x: 66, y: 48 }, { x: 176, y: 24 }, { x: 286, y: 72 },
    { x: 374, y: 36 }, { x: 132, y: 90 }, { x: 242, y: 18 },
    { x: 330, y: 60 }, { x: 88, y: 30 },
  ];
  stars.forEach((star, i) => {
    const twinkle = Math.sin(frame * 0.05 + i * 0.8) * 0.5 + 0.5;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 1.5 + twinkle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.7})`;
    ctx.fill();
  });

  // Moon
  const moonX = w * 0.8;
  const moonY = h * 0.15;
  const moonGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 40);
  moonGrad.addColorStop(0, "rgba(200, 220, 255, 0.3)");
  moonGrad.addColorStop(1, "transparent");
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
  ctx.fill();

  // Water lines
  for (let i = 0; i < 3; i++) {
    const y = h * 0.65 + i * 28;
    const shimmer = Math.sin(frame * 0.03 + i) * 0.3 + 0.5;
    ctx.strokeStyle = `rgba(100, 180, 255, ${0.1 + shimmer * 0.15})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const wave = Math.sin(x * 0.02 + frame * 0.02 + i) * 3;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

// ============================================================
// DARK — Lightning + Rain + Fog
// ============================================================
function drawDark(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0a0a1a");
  grad.addColorStop(0.4, "#1a0a2e");
  grad.addColorStop(1, "#0d0d2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Lightning flash
  if (frame % 240 > 225 && frame % 240 < 230) {
    ctx.fillStyle = "rgba(180, 160, 255, 0.15)";
    ctx.fillRect(0, 0, w, h);
  }

  // Rain
  ctx.strokeStyle = "rgba(100, 120, 180, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const x = (i * 7 + frame * 2) % w;
    const y = (i * 13 + frame * 4) % h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1, y + 12);
    ctx.stroke();
  }

  // Fog
  const fogY = h * 0.7;
  const fogGrad = ctx.createRadialGradient(w / 2, fogY, 0, w / 2, fogY, w * 0.7);
  fogGrad.addColorStop(0, "rgba(30, 20, 60, 0.5)");
  fogGrad.addColorStop(1, "transparent");
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, fogY - 60, w, 120);
}

// ============================================================
// ZEN — Orbs + Calm Water
// ============================================================
function drawZen(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0a1a1a");
  grad.addColorStop(0.5, "#0d2a2a");
  grad.addColorStop(1, "#0a1a1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Floating orbs
  for (let i = 0; i < 5; i++) {
    const x = w * 0.2 + i * w * 0.15;
    const y = h * 0.3 + Math.sin(frame * 0.02 + i * 1.5) * 30;
    const radius = 15 + Math.sin(frame * 0.03 + i) * 5;

    const orbGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    orbGrad.addColorStop(0, "rgba(100, 200, 200, 0.3)");
    orbGrad.addColorStop(1, "transparent");
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Calm water
  for (let i = 0; i < 5; i++) {
    const y = h * 0.7 + i * 15;
    ctx.strokeStyle = `rgba(100, 200, 200, ${0.05 + i * 0.02})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const wave = Math.sin(x * 0.01 + frame * 0.01 + i * 0.5) * 2;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

// ============================================================
// WONDER — Aurora + Stars
// ============================================================
function drawWonder(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1a0a2e");
  grad.addColorStop(0.5, "#2a1040");
  grad.addColorStop(1, "#0a0a1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Aurora
  for (let i = 0; i < 3; i++) {
    const auroraY = h * 0.2 + i * 40;
    ctx.strokeStyle = `rgba(${150 + i * 30}, ${100 + i * 50}, 255, ${0.1 - i * 0.02})`;
    ctx.lineWidth = 30 + i * 10;
    ctx.beginPath();
    for (let x = 0; x < w; x += 3) {
      const wave = Math.sin(x * 0.01 + frame * 0.02 + i * 2) * 20;
      ctx.lineTo(x, auroraY + wave);
    }
    ctx.stroke();
  }

  // Stars
  for (let i = 0; i < 20; i++) {
    const x = (i * 23) % w;
    const y = (i * 37 + 50) % (h * 0.6);
    const twinkle = Math.sin(frame * 0.08 + i * 1.2) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + twinkle, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================
// HORROR — Red glow + Eyes
// ============================================================
function drawHorror(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1a0505");
  grad.addColorStop(0.5, "#2a0a0a");
  grad.addColorStop(1, "#0a0505");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Red pulse
  const pulse = Math.sin(frame * 0.03) * 0.15 + 0.15;
  ctx.fillStyle = `rgba(200, 0, 0, ${pulse})`;
  ctx.fillRect(0, 0, w, h);

  // Eyes (appearing occasionally)
  if (frame % 300 > 100 && frame % 300 < 200) {
    const eyes = [
      { x: 80, y: 200 }, { x: 360, y: 180 },
      { x: 200, y: 350 }, { x: 320, y: 400 },
    ];
    eyes.forEach((eye) => {
      const blink = Math.sin(frame * 0.1) > 0.8 ? 0 : 1;
      if (blink) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

// ============================================================
// CONFUSED — Fog + Spiral
// ============================================================
function drawConfused(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(0.5, "#2a1a3e");
  grad.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Fog layers
  for (let i = 0; i < 3; i++) {
    const fogX = (frame * (0.5 + i * 0.3)) % (w + 200) - 100;
    const fogY = h * 0.3 + i * 80;
    const fogGrad = ctx.createRadialGradient(fogX, fogY, 0, fogX, fogY, 100 + i * 30);
    fogGrad.addColorStop(0, `rgba(80, 60, 120, ${0.15 - i * 0.03})`);
    fogGrad.addColorStop(1, "transparent");
    ctx.fillStyle = fogGrad;
    ctx.beginPath();
    ctx.arc(fogX, fogY, 100 + i * 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spiral
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = "rgba(150, 120, 200, 0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 6; t += 0.05) {
    const r = t * 8 + Math.sin(frame * 0.02) * 5;
    const x = cx + Math.cos(t + frame * 0.01) * r;
    const y = cy + Math.sin(t + frame * 0.01) * r;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}
