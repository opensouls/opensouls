import React from "react";
import { Link, Text, Flex } from "@radix-ui/themes";
import Image from "next/image";

const VerticalSidebar = ({ text }: { text: string }) => {
  return (
    <div
      style={{
        width: "48px",
        backgroundColor: "var(--slate-3)",
        position: "fixed",
        height: "100vh",
        zIndex: 1000,
        borderRight: "0.5px solid var(--slate-4)",
      }}
    >
      <div style={{ transform: "rotate(-90deg)", marginTop: "166px" }}>
        <Text
          style={{
            fontSize: 16,
            color: "var(--slate-8)",
            fontFamily: "CabinetGrotesk-Bold",
            whiteSpace: "nowrap",
          }}
        >
          Soul Engine{" "}
          <Text
            style={{
              fontSize: 16,
              color: "var(--slate-12)",
              fontFamily: "CabinetGrotesk-Bold",
              marginLeft: "16px",
            }}
          >
            {text ?? "Inspector"}
          </Text>
        </Text>
      </div>
    </div>
  );
};

export default VerticalSidebar;
