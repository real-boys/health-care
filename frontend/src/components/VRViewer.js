import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Float, MeshDistortMaterial } from '@react-three/drei';
import { VRCanvas, Hands } from '@react-three/xr';

const MedicalScene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[0, 0, -5]}>
          <sphereGeometry args={[1, 32, 32]} />
          <MeshDistortMaterial color="#ef4444" speed={2} distort={0.4} />
        </mesh>
      </Float>

      <Text
        position={[0, 2, -5]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        Healthcare VR Training
      </Text>

      <OrbitControls />
    </>
  );
};

const VRViewer = () => {
  return (
    <div style={{ width: '100%', height: '500px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
      <Suspense fallback={<div>Loading 3D Scene...</div>}>
        <Canvas>
          <MedicalScene />
        </Canvas>
      </Suspense>
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', color: 'white', zIndex: 10 }}>
        <button onClick={() => alert('Entering VR Mode...')}>Enter VR</button>
      </div>
    </div>
  );
};

export default VRViewer;
