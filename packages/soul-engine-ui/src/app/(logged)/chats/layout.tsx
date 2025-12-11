"use client";

import { NextPage } from "next";
import React from "react";

const ChatPageLayout: NextPage<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="chat-page-layout">{children}</div>;
};

export default ChatPageLayout;
