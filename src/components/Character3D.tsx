import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useEffect } from 'react';
import type { Group } from 'three';

function Model() {
    const groupRef = useRef<Group>(null);
    const [mouseX, setMouseX] = useState(0);
    const [mouseY, setMouseY] = useState(0);

    const { scene } = useGLTF('/models/jj-character.glb');

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

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y +=
                (mouseX * 0.3 - groupRef.current.rotation.y) * 0.05;
            groupRef.current.rotation.x +=
                (-mouseY * 0.2 - groupRef.current.rotation.x) * 0.05;
        }
    });

    return (
        <group ref={groupRef}>
            <primitive object={scene} scale={1.5} position={[0, -1.0, 0]} />
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
                <ambientLight intensity={0.5} />
                <directionalLight position={[2, 2, 2]} intensity={1} />
                <directionalLight position={[-2, 1, -1]} intensity={0.3} />
                <Model />
            </Suspense>
        </Canvas>
    );
}

useGLTF.preload('/models/jj-character.glb');