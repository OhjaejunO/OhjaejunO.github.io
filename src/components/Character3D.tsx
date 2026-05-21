import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useEffect } from 'react';
import type { Group } from 'three';

function Model() {
    const groupRef = useRef<Group>(null);
    const [mouseX, setMouseX] = useState(0);
    const [mouseY, setMouseY] = useState(0);

    // GLB 모델 로드
    const { scene } = useGLTF('/models/jj-character.glb');

    // 마우스 추적
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = -(e.clientY / window.innerHeight) * 2 + 1;
            setMouseX(x);
            setMouseY(y);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // 매 프레임마다 회전 업데이트
    useFrame(() => {
        if (groupRef.current) {
            // 마우스 방향으로 부드럽게 회전 (Lerp)
            groupRef.current.rotation.y +=
                (mouseX * 0.3 - groupRef.current.rotation.y) * 0.05;
            groupRef.current.rotation.x +=
                (-mouseY * 0.2 - groupRef.current.rotation.x) * 0.05;
        }
    });

    return (
        <group ref={groupRef}>
            <primitive object={scene} scale={1.5} position={[0, -1.5, 0]} />
        </group>
    );
}

export default function Character3D() {
    return (
        <Canvas
            camera={{ position: [0, 0, 3], fov: 45 }}
            style={{ width: '100%', height: '100%' }}
        >
            <Suspense fallback={null}>
                {/* 조명 */}
                <ambientLight intensity={0.5} />
                <directionalLight position={[2, 2, 2]} intensity={1} />
                <directionalLight position={[-2, 1, -1]} intensity={0.3} />

                {/* 3D 모델 */}
                <Model />
            </Suspense>
        </Canvas>
    );
}

// 모델 미리 로드
useGLTF.preload('/models/jj-character.glb');
