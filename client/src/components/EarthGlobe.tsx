import { useEffect, useRef, useState } from "react";

const EARTH_TEXTURE_URL = "/earth-blue-marble.webp";
const EARTH_FALLBACK_URL = "/earth-blue-marble-fallback.webp";

const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform float uRotation;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float cosine = cos(uRotation);
    float sine = sin(uRotation);
    vec3 rotated = vec3(
      cosine * aPosition.x + sine * aPosition.z,
      aPosition.y,
      -sine * aPosition.x + cosine * aPosition.z
    );
    vNormal = rotated;
    vUv = aUv;
    gl_Position = vec4(rotated.xy * 0.96, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D uEarthTexture;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec3 normal = normalize(vNormal);
    if (normal.z < -0.02) discard;

    vec3 lightDirection = normalize(vec3(-0.42, 0.28, 1.0));
    float illumination = 0.3 + 0.7 * max(dot(normal, lightDirection), 0.0);
    vec3 surface = texture2D(uEarthTexture, vUv).rgb * illumination;
    float rim = pow(1.0 - max(normal.z, 0.0), 2.2);
    surface += vec3(0.08, 0.34, 0.72) * rim * 0.24;

    float alpha = smoothstep(-0.02, 0.035, normal.z);
    gl_FragColor = vec4(surface, alpha);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createSphereMesh(latitudeSegments = 48, longitudeSegments = 96) {
  const vertexCount = (latitudeSegments + 1) * (longitudeSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  let vertex = 0;

  for (let latitudeIndex = 0; latitudeIndex <= latitudeSegments; latitudeIndex += 1) {
    const v = latitudeIndex / latitudeSegments;
    const latitude = (v - 0.5) * Math.PI;
    const latitudeRadius = Math.cos(latitude);

    for (let longitudeIndex = 0; longitudeIndex <= longitudeSegments; longitudeIndex += 1) {
      const u = longitudeIndex / longitudeSegments;
      const longitude = (u - 0.5) * Math.PI * 2;
      positions[vertex * 3] = latitudeRadius * Math.sin(longitude);
      positions[vertex * 3 + 1] = Math.sin(latitude);
      positions[vertex * 3 + 2] = latitudeRadius * Math.cos(longitude);
      uvs[vertex * 2] = u;
      uvs[vertex * 2 + 1] = v;
      vertex += 1;
    }
  }

  const indices = new Uint16Array(latitudeSegments * longitudeSegments * 6);
  let index = 0;
  for (let latitudeIndex = 0; latitudeIndex < latitudeSegments; latitudeIndex += 1) {
    for (let longitudeIndex = 0; longitudeIndex < longitudeSegments; longitudeIndex += 1) {
      const first = latitudeIndex * (longitudeSegments + 1) + longitudeIndex;
      const next = first + longitudeSegments + 1;
      indices[index++] = first;
      indices[index++] = next;
      indices[index++] = first + 1;
      indices[index++] = next;
      indices[index++] = next + 1;
      indices[index++] = first + 1;
    }
  }

  return { positions, uvs, indices };
}

/**
 * NASA Blue Marble imagery mapped onto a lightweight WebGL sphere.
 * The public fallback image remains visible if WebGL or the texture cannot load.
 */
export default function EarthGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const uvLocation = gl.getAttribLocation(program, "aUv");
    const rotationLocation = gl.getUniformLocation(program, "uRotation");
    const textureLocation = gl.getUniformLocation(program, "uEarthTexture");
    const positionBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const texture = gl.createTexture();

    if (
      positionLocation < 0 ||
      uvLocation < 0 ||
      !rotationLocation ||
      !textureLocation ||
      !positionBuffer ||
      !uvBuffer ||
      !indexBuffer ||
      !texture
    ) {
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(uvBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      return;
    }

    const { positions, uvs, indices } = createSphereMesh();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(textureLocation, 0);

    let disposed = false;
    let frameId = 0;
    let didRender = false;
    let textureLoaded = false;
    const animationStart = performance.now();
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const image = new Image();
    image.decoding = "async";

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(1, Math.round(Math.min(bounds.width, bounds.height) * pixelRatio));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
        gl.viewport(0, 0, size, size);
      }
    };

    const stopAnimation = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const renderFrame = (timestamp: number) => {
      frameId = 0;
      if (disposed || !textureLoaded) return;
      resizeCanvas();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(rotationLocation, motionPreference.matches ? 0 : (timestamp - animationStart) * 0.00052);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      if (!didRender) {
        didRender = true;
        setWebglReady(true);
      }
      if (!motionPreference.matches && document.visibilityState === "visible") {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };

    const requestFrame = () => {
      if (!disposed && textureLoaded && !frameId && document.visibilityState === "visible") {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestFrame();
      else stopAnimation();
    };
    const handleMotionPreference = () => {
      stopAnimation();
      if (motionPreference.matches) renderFrame(performance.now());
      else requestFrame();
    };
    const handleResize = () => {
      if (motionPreference.matches) renderFrame(performance.now());
      else requestFrame();
    };

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(handleResize)
      : null;
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    motionPreference.addEventListener("change", handleMotionPreference);

    image.onload = () => {
      if (disposed) return;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      textureLoaded = true;
      if (motionPreference.matches) renderFrame(performance.now());
      else requestFrame();
    };
    image.src = EARTH_TEXTURE_URL;

    return () => {
      disposed = true;
      stopAnimation();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      motionPreference.removeEventListener("change", handleMotionPreference);
      image.onload = null;
      image.onerror = null;
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(uvBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
      {!webglReady && (
        <img
          src={EARTH_FALLBACK_URL}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${webglReady ? "opacity-100" : "opacity-0"}`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_-9px_-4px_18px_rgba(0,0,0,0.35),inset_4px_3px_12px_rgba(255,255,255,0.12)]" />
    </div>
  );
}
