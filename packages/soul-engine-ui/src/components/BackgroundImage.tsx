"use client";
import React, { useState } from "react";
import Image from "next/legacy/image";

const BackgroundImage = ({
  imageUrl,
  children,
}: {
  imageUrl: string;
  children?: React.ReactNode;
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <div className="fixed w-full h-full select-none overflow-hidden">
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: imageLoaded ? "transparent" : "#1C1C1E", // zinc-950 color
          transition: "background-color 1s ease-in-out",
          zIndex: -1,
        }}
      >
        <Image
          src={imageUrl}
          alt="Background"
          layout="fill"
          objectFit="cover"
          objectPosition="center"
          onLoad={handleImageLoad}
          style={{
            opacity: imageLoaded ? 1 : 0,
            transition: "opacity 2s ease-in-out",
          }}
        />
      </div>
      {children}
    </div>
  );
};

export default BackgroundImage;
