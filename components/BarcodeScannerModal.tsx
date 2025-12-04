import React, { useEffect, useRef, useState } from 'react';
// IMPORT DIRECTLY FROM LOCAL PACKAGES
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

const BarcodeScanner = ({ onResult }) => {
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;

    // Start decoding from video device
    codeReader.decodeFromVideoDevice(
      null, // use default camera
      videoRef.current,
      (result, err) => {
        if (!isMounted) return;

        if (result) {
          // Success! Pass result to parent
          onResult(result.getText());
        }
        
        if (err && !(err instanceof NotFoundException)) {
          // Ignore "NotFound" errors (they happen every frame no code is found)
          console.error(err);
          setError(err.message);
        }
      }
    ).catch(err => {
      console.error("Camera setup error:", err);
      setError("Camera setup error: " + err.message);
    });

    // Cleanup function: Stop camera when component unmounts
    return () => {
      isMounted = false;
      codeReader.reset();
    };
  }, [onResult]);

  return (
    <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
      <video 
        ref={videoRef} 
        style={{ width: '100%', border: '1px solid #ccc' }} 
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default BarcodeScanner;