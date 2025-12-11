"use client";
import { Button, Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { NextPage } from "next";
import { useState } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

const CopyButton = ({token}: {token: string}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyClick = () => {
      navigator.clipboard.writeText(token)
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button onClick={handleCopyClick} style={{borderRadius: 1, backgroundColor: "var(--iris-7)", marginBottom: 10, cursor: 'pointer'}}>
    <div style={{paddingTop: 3}}>
    {copied ? <FaCheck size="12" style={{color: 'var(--green-11)', paddingLeft: 3, marginRight: -2}} /> : <FaCopy size="12" style={{paddingLeft: 3, marginRight: -2}} />}
    </div>
        <Text>token</Text>
    </Button>
  )
}

export default CopyButton
