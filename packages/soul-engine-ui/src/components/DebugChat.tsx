"use client";
import { Tabs, Box, Button, Text, TextField, Badge, Tooltip, ScrollArea } from "@radix-ui/themes";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useDebugChatState } from "@/hooks/useDebugChatState";
import { FaArrowDown, FaArrowUp } from "react-icons/fa6";
import { RxReset } from "react-icons/rx";
import { RiBugLine } from "react-icons/ri";
import { TbClock } from "react-icons/tb";
import { Pencil2Icon } from "@radix-ui/react-icons";
import * as Separator from "@radix-ui/react-separator";
import { SoulEvent, SoulEventKinds, Json, Events, ChatMessageRoleEnum } from "@opensouls/engine";
import { PanelGroup, PanelResizeHandle, Panel as ResizablePanel } from "react-resizable-panels";
import { v4 as uuidv4 } from "uuid";

import { useSoulStore } from "@/hooks/useSoulStores";
import { humanReadableDate, humanReadableSchedule } from "@/lib/humanDate";

import DebugSoulHeader from "@/components/DebugSoulHeader";
import DebugCodeUpdateBadge from "./DebugCodeUpdateBadge";
import DebugPerceptionEditor, { CustomPerception } from "@/components/DebugPerceptionField";
import { DebugMessage } from "@/components/DebugMessage";
import { MemoryCell } from "@/components/MemoryCell"

import "./DebugChat.css";
import { useLocalStorage } from "usehooks-ts";
import WorkingMemoryDivider, { RegionHeader } from "./WorkingMemoryDivider";
import { StateCommit } from "@/lib/documentStores";

export type PageState = 'pending' | 'auth-mismatch' | 'error' | 'connected' | 'disconnected';

export type PageData = {
  state: PageState,
  text: string,
}

const INIT_PAGE: PageData = {
  state: 'pending',
  text: 'Soul Loading',
};

const defaultUserPerception: CustomPerception = {
  name: "Interlocutor",
  action: "says",
  internal: false,
  _kind: SoulEventKinds.Perception,
  _metadata: undefined,
}

const defaultSoulPerception: CustomPerception = {
  name: "???",
  action: "said",
  internal: false,
  _kind: SoulEventKinds.InteractionRequest,
  _metadata: undefined,
}

export type OrgSettings = {
};
export type SoulSettings = {
  showLogs: boolean;
  showTimestamp: boolean;
};
export type ChatSettings = {
  perceptionEditor: boolean;
  sendAsUser: boolean;
  saveToMemory: boolean;
  userPerception: CustomPerception;
  soulPerception: CustomPerception;
};

const defaultOrgSettings: OrgSettings = {};
const defaultSoulSettings: SoulSettings = {
  showLogs: true,
  showTimestamp: false,
};
const defaultChatSettings: ChatSettings = {
  perceptionEditor: true,
  sendAsUser: true,
  saveToMemory: true,
  userPerception: defaultUserPerception,
  soulPerception: defaultSoulPerception,
};

const freeze = (p: any) => JSON.parse(JSON.stringify(p))

const CountingDownEvents: React.FC<{
  index: string,
  stateString: string,
}> = ({ stateString, index }) => {
  const rerender = useRef(false);
  const [_, setRender] = useState(rerender.current);
  useEffect(() => {
    setInterval(() => {
      rerender.current = !rerender.current;
      setRender(rerender.current);
    }, 500);
  }, []);
  return (
    <MemoryCell
      key={"pendingEvents-outer" + index}
      index={index}
      state={stateString}
    />
  )
}

const DebugChat: React.FC<{
  organizationSlug: string;
  subroutineId: string;
  chatId: string;
}> = ({ organizationSlug: organizationId, subroutineId, chatId }) => {
  const { state, provider, events, revertTo, metadata } = useDebugChatState(
    organizationId,
    subroutineId,
    chatId
  );
  const { memoryStore, vectorStore } = useSoulStore(
    organizationId,
    subroutineId,
    chatId
  );

  const environmentVariables = Object.entries(metadata?.environment || {}).map(([k, v]) => ({
    key: k,
    value: v,
  }));

  const [selectedCommitIndex, setSelectedCommitIndex] = useState(0)
  const commit: StateCommit = ((state.commits || [])[selectedCommitIndex] || state)

  const [messageInput, setUserMessage] = useState("");

  const [orgSettings, setOrgSettings] = useLocalStorage(`organizationSettings-${organizationId}`, defaultOrgSettings);
  const [soulSettings, setSoulSettings] = useLocalStorage(`soulSettings-${organizationId}-${subroutineId}`, defaultSoulSettings);
  const [chatSettings, setChatSettings] = useLocalStorage(`chatSettings-${organizationId}-${subroutineId}-${chatId}`, defaultChatSettings);

  const [showSidebar, setShowSidebar] = useState(true);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkWidth = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        setShowSidebar(width >= 768);
      }
    };

    const resizeObserver = new ResizeObserver(checkWidth);

    if (chatPanelRef.current) {
      const parentElement = chatPanelRef.current.parentElement;
      if (parentElement) {
        resizeObserver.observe(parentElement);
      }
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);


  function togglePerception(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setChatSettings({ ...chatSettings, perceptionEditor: !chatSettings.perceptionEditor });
  }
  const bottomOfChat = useRef<HTMLDivElement | null>(null);
  const bottomOfWorkingMem = useRef<HTMLDivElement | null>(null);
  const rerender = useRef(false);
  const [_, setRender] = useState(rerender.current);
  useEffect(() => {
    setInterval(() => {
      rerender.current = !rerender.current;
      setRender(rerender.current);
    }, 60000);
  }, []);

  const [pageState, setPageState] = useState(INIT_PAGE);
  useEffect(() => {
    if (!metadata?.connection) {
      return;
    }

    if (metadata.connection === 'error') {
      setPageState({ state: 'error', text: 'metadata.connection error.' });
    } else if (metadata.connection === 'notFound') {
      setPageState({ state: 'error', text: `Have you run 'bunx soul-engine dev' yet?` });
    } else if (metadata.connection === 'disconnected') {
      setPageState({ state: 'disconnected', text: '' });
    } else {
      setPageState({ state: 'connected', text: '' });
    }
  }, [metadata.connection, organizationId]);

  const [lastCodeUpdate, setLastCodeUpdate] = useState(metadata?.codeUpdatedAt);
  useEffect(() => {
    setLastCodeUpdate(metadata?.codeUpdatedAt);
  }, [metadata?.codeUpdatedAt]);

  const workingPerception = chatSettings.sendAsUser ? chatSettings.userPerception : chatSettings.soulPerception;
  const [loadedSoulPerception, setLoadedSoulPerception] = useState<CustomPerception>(defaultSoulPerception);
  const sendUserMessage = useCallback(() => {
    scrollToBottom(textBoxRef);
    const perception = chatSettings.perceptionEditor ? chatSettings.userPerception : defaultUserPerception;
    const request = JSON.stringify({
      event: Events.dispatchExternalPerception,
      data: {
        perception: { ...perception, content: messageInput },
      },
    })

    provider.sendStateless(request);
    setUserMessage("");
  }, [provider, messageInput, chatSettings.perceptionEditor, chatSettings.userPerception]);

  function createMemory(perception: CustomPerception, messageInput: string) {

    const nameAction = `${perception.name} ${perception.action}`;
    const message = messageInput ? `: ${messageInput}` : '';

    return {
      role: ChatMessageRoleEnum.Assistant,
      content: `${nameAction}${message}`,
      name: perception.name,
      metadata: perception._metadata,
      _id: uuidv4(),
      _timestamp: Date.now(),
    };
  };

  const sendSoulSpoof = useCallback(() => {
    if (state?.attributes === undefined) {
      console.error('Cannot send Soul perception without initial state');
      return;
    }

    scrollToBottom(textBoxRef);

    const perception = {
      ...(chatSettings.perceptionEditor ? chatSettings.soulPerception : loadedSoulPerception),
    };

    const soulEvent = {
      ...perception,
      _id: uuidv4(),
      _timestamp: Date.now(),
      content: messageInput
    };

    events.push(soulEvent);
    if (chatSettings.saveToMemory) {
      const memory = createMemory(perception, messageInput);
      state?.memories?.push(memory);
    }

    setUserMessage("");

  }, [messageInput, state?.attributes, state?.memories, events, metadata, chatSettings, loadedSoulPerception]);

  const send = useCallback(() => {
    if (chatSettings.sendAsUser) {
      sendUserMessage();
    } else {
      sendSoulSpoof();
    }
  }, [chatSettings.sendAsUser, sendUserMessage, sendSoulSpoof]);

  //update the active soul name from the state.attributes.name field
  useEffect(() => {
    const env = metadata?.environment as { [key: string]: any } | undefined;
    let name = (env?.entityName as string) ?? state.attributes?.name ?? 'Soul';

    setChatSettings(prev => ({ ...prev, soulPerception: { ...prev.soulPerception, name } }));
    setLoadedSoulPerception({ ...defaultSoulPerception, name });
  }, [state?.attributes, metadata?.environment, setChatSettings]);

  const [tab, setTab] = useState('tab1');
  const [isChatScrolled, setIsChatScrolled] = useState(false);
  const [isMemScrolled, setIsMemScrolled] = useState(false);
  const textBoxRef = useRef<HTMLDivElement>(null);
  const memBoxRef = useRef<HTMLDivElement>(null);

  const handleScroll = (ref: RefObject<HTMLDivElement>, setScrolledUp?: (b: boolean) => void, setScrollAmount?: (n: number) => void) => {
    if (ref.current) {
      const pageHeight = ref.current.clientHeight;
      const scrollHeight = ref.current.scrollHeight;
      const scrollTop = ref.current.scrollTop;
      const distanceFromBottom = scrollHeight - scrollTop - pageHeight;
      if (setScrolledUp) { setScrolledUp(distanceFromBottom > 100); }
      if (setScrollAmount) { setScrollAmount(scrollTop); }
    }
  };

  useEffect(() => {
    if (!textBoxRef.current) { return; }

    const textBoxScrollHandler = () => handleScroll(textBoxRef, setIsChatScrolled);
    const resizeHandler = () => handleScroll(textBoxRef, setIsChatScrolled);

    textBoxRef.current.addEventListener('scroll', textBoxScrollHandler);
    window.addEventListener('resize', resizeHandler);
    return () => {
      textBoxRef.current?.removeEventListener('scroll', textBoxScrollHandler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  const scrollToBottom = (ref: React.RefObject<HTMLElement>, behavior: ScrollBehavior = 'smooth') => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: behavior
      });
    }
  };

  const lengthOfLastMsg = (events?.slice(-1) || [])[0]?.content?.length;
  useEffect(() => {
    if (isChatScrolled) { return; }
    async function wait() {
      await new Promise((resolve) => setTimeout(resolve, 25));
      scrollToBottom(textBoxRef);
    }
    wait();
  }, [events?.length, lengthOfLastMsg]);

  const lengthOfLastMem = (state?.memories?.slice(-1) || [])[0]?.content?.length;
  useEffect(() => {
    if (isMemScrolled) { return; }
    scrollToBottom(memBoxRef);
  }, [state?.memories?.length, lengthOfLastMem]);

  useEffect(() => {
    setSelectedCommitIndex((state.commits?.length || 0) - 1)
  }, [state.commits?.length])

  const chatMessages =
    events?.filter((m: SoulEvent) => {
      return (
        (m._kind == SoulEventKinds.InteractionRequest ||
          m._kind == SoulEventKinds.System ||
          m._kind == SoulEventKinds.Perception) &&
        ![
          "mainThreadStart",
          "mainThreadStop",
          "subProcessStart",
          "subProcessStop",
        ].includes(m.action)
      );
    }) || [];

  const isRunningMainThread = (() => {
    const lastMainThreadStartIndex = events
      ?.map((event, index) => ({ event, index }))
      .filter(({ event }) => event.action === "mainThreadStart")
      .map(({ index }) => index)
      .pop();

    if (lastMainThreadStartIndex !== undefined) {
      const subsequentEvents = events.slice(lastMainThreadStartIndex + 1);
      return !subsequentEvents.some(
        (event) => event.action === "mainThreadStop"
      );
    }
    return false;
  })();

  const isRunningSubprocess = (() => {
    const lastThreadStartIndex = events
      ?.map((event, index) => ({ event, index }))
      .filter(({ event }) => event.action === "subProcessStart")
      .map(({ index }) => index)
      .pop();

    if (lastThreadStartIndex !== undefined) {
      const subsequentEvents = events.slice(lastThreadStartIndex + 1);
      return !subsequentEvents.some(
        (event) => event.action === "subProcessStop"
      );
    }
    return false;
  })();

  const subprocessStates =
    (Object.entries(state?.subprocessStates || {}).map(
      ([subprocessName, processMemories]) => {
        return [subprocessName, processMemories.map((c) => c?.current)]
      }
    ) || []).filter(x => x[1].length > 0);

  const processState =
    (state?.processMemory || []).map((t) => t?.current) || [];

  const soulMemories = Object.entries(memoryStore).map(([k, v]) => ({
    key: k,
    value: Array.isArray(v)
      ? v
      : typeof v === "object" && v !== null
        ? v.current
        : v,
  }));

  const soulStore = Object.entries(vectorStore).map(([k, v]) => ({
    key: k,
    value: v?.content || (v as any)?.value,
  }));

  const pendingScheduledEvents = Object.entries(state?.pendingScheduledEvents || {}).map(([k, v]) => ({
    key: humanReadableSchedule(v.when!),
    value: v as unknown as Json
  }));

  const canChat = pageState.state === 'connected';
  const noState = (!chatSettings.sendAsUser && Object.keys(state).length === 0);
  const disableMessageInput = !canChat || noState;
  const disableSendButton = disableMessageInput || !workingPerception.name || !workingPerception.action || noState;
  const disableSendWithEnter = disableMessageInput || messageInput?.trim().length === 0 || disableSendButton;

  let lastName = '';

  return (
    <div className="relative w-full h-full" ref={chatPanelRef}>
      <PanelGroup direction="horizontal">
        <ResizablePanel minSize={50} order={1} defaultSize={75}>
          <div className="flex flex-row h-full w-full mx-auto overflow-hidden justify-start pt-4 pr-4 pl-8">
            {/* Chat Wrap-------------------------------------------------------------------------- */}
            <div className="flex flex-col max-h-[90vh] w-full pb-1">
              {/* Simulation and Reset -------------------------------------------------------------------------- */}
              <div className="flex-row gap-0 pb-4 border-b border-slate-700">
                <div className="flex items-center justify-between w-full gap-4">
                  <Text className="font-OS_bold text-slate-400">Event Log</Text>
                  <div className="flex flex-row items-center gap-1 justify-center">
                    <Tooltip content={soulSettings.showTimestamp ? 'Hide logs' : 'Show logs'}>
                      <Button
                        className="w-8"
                        size="1"
                        variant='soft'
                        color={soulSettings.showTimestamp ? "indigo" : "gray"}
                        onClick={() => setSoulSettings({ ...soulSettings, showTimestamp: !soulSettings.showTimestamp })}
                      >
                        <TbClock width={24} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={soulSettings.showLogs ? 'Hide logs' : 'Show logs'}>
                      <Button
                        className="w-8"
                        size="1"
                        variant='soft'
                        color={soulSettings.showLogs ? "indigo" : "gray"}
                        onClick={() => setSoulSettings({ ...soulSettings, showLogs: !soulSettings.showLogs })}
                      >
                        <RiBugLine width={32} />
                      </Button>
                    </Tooltip>
                    {/* TODO: implement mobile view of the memory and state panel */}
                    {/* <div className="md:hidden flex flex-row">
                    <Tooltip content="Show memory">
                      <Button
                        size="1"
                        variant={showSidebar ? 'soft' : 'surface'}
                        color={showSidebar ? "indigo" : "gray"}
                        className="w-16"
                        onClick={() => setShowSidebar(!showSidebar)}
                      >
                        <RiChatHistoryFill width={32} />
                      </Button>
                    </Tooltip>
                  </div> */}
                    <Button
                      size="1"
                      variant="soft"
                      color="red"
                      onClick={() => {
                        revertTo("initial");
                        setSelectedCommitIndex(0)
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <></>
                </div>
              </div>

              {/* Simulation Wrapper to Bottom - Stop at Chat Input ------------------------------- */}

              <div className="flex-col grow gap-4 mt-2 pb-4 overflow-y-auto hide-scrollbar" ref={textBoxRef}>

                {/* Soul Started ----------------------------------------------------------- */}
                <div className="self-center mt-8">
                  <DebugSoulHeader organizationId={organizationId} subroutineId={subroutineId} pageState={pageState} />
                </div>

                {chatMessages.map((m: SoulEvent, i) => {

                  const isSoul = m._kind === SoulEventKinds.InteractionRequest;
                  const isUser = m._kind === SoulEventKinds.Perception && !m.internal;

                  const isSpeech = ["said", "says"].includes(m.action);
                  const isSystem = m._kind === SoulEventKinds.System || m.internal;
                  const isCompile = m.internal === true && m?._metadata?.process === "compile";
                  const isError = m._metadata?.type === "error";
                  let backgroundColor: string | undefined = undefined;

                  const showState =
                    !chatMessages[i - 1]?._metadata?.stateId ||
                    m._metadata?.stateId !== chatMessages[i - 1]?._metadata?.stateId;
                  const showRevert = chatMessages[i - 1]?._metadata?.stateId;
                  const nameChange = m.name !== undefined && m.name !== lastName; //m.name !== chatMessages[i - 1]?.name;

                  if (m.name && m.name !== lastName) {
                    lastName = m.name;
                  }

                  {
                    /* Conversation Styles Need to Extend these in TW config----------------------- */
                  }

                  if (isSystem) {
                    backgroundColor = "var(--slate-3)";
                  }
                  if (isUser) {
                    backgroundColor = "var(--iris-2)";
                  }
                  if (isSoul) {
                    backgroundColor = "var(--slate-2)";
                  }

                  const textSize = isSystem ? "1" : "3";
                  const marginLeft = isSystem ? "8" : "0";

                  if (isCompile) {
                    return null;
                  }
                  {
                    /* System Error---------------------------------------------------------------- */
                  }
                  if (isError) {
                    return (
                      <div
                        className={`flex p-2 flex-col justify-between ml-${marginLeft} mt-4`}
                        key={`isError-${i}`}
                      >
                        <div className={`flex flex-col items-center gap-4 animate-fadeIn`}>
                          <Badge variant="surface" color='red' className={`w-auto`}>
                            <div className="flex flex-row justify-between gap-2 items-start">
                              <p className="font-OS_mono_regular text-md whitespace-normal select-text" style={{ overflowWrap: "anywhere" }}>
                                {m.content}
                              </p>
                            </div>
                          </Badge>
                        </div>

                      </div>
                    );
                  }

                  const prepend = (
                    <>
                      {showState &&
                        <div className="flex flex-row items-center justify-between mt-8 gap-4">

                          {showRevert &&
                            <>
                              <Separator.Root
                                className="SeparatorRoot"
                                decorative
                                orientation="horizontal"
                                style={{ backgroundColor: "var(--gray-4)", margin: "0 0px" }}
                              />
                              <Button
                                className="cursor-pointer"
                                size="1"
                                color="gray"
                                variant="soft"
                                onClick={() => revertTo(chatMessages[i - 1]?._metadata?.stateId as string)}
                              >
                                <RxReset className="mx-2" />
                              </Button>
                            </>}
                          {/* <Box className="ml-8 w-[100%] h-[0.5px] border-dotted bg-slate-700 mr-4" /> */}
                        </div>
                      }
                    </>
                  );

                  const append = (
                    <>
                    </>
                  );

                  if (isSystem) {
                    return (
                      <div key={`isSystem-${i}`}>
                        {prepend}

                        {/* Mental and Process Styles---------------------------------------------- */}
                        {soulSettings.showLogs &&
                          <div className="flex justify-between gap-6 rounded-sm ml-8">
                            <Text
                              className="self-center font-OS_mono_regular text-lime-600 leading-relaxed pr-8 pt-4 whitespace-pre-wrap"
                              size={textSize}
                              style={{ textIndent: "-14px", overflowWrap: "anywhere" }}
                            >
                              {"> " + m.content}
                            </Text>
                          </div>}
                        {append}
                      </div>
                    );
                  }


                  {
                    /* Text Box---------------------------------------------------------------- */
                  }
                  return (
                    <div key={`chat-message-${i}`} className={nameChange ? 'mt-6' : 'mt-4'}>
                      {prepend}
                      {/* You and Soul Name Headers ---------------------------------------------- */}
                      <DebugMessage
                        key={`message-${i}`}
                        m={m}
                        isSpeech={isSpeech}
                        isUser={isUser}
                        isSoul={isSoul}
                        showName={nameChange}
                        showTimestamp={soulSettings.showTimestamp}
                        backgroundColor={backgroundColor}
                      />
                      {append}
                    </div>
                  );
                })}

                {/* Soul Expired ----------------------------------------------------------- */}
                {state?.complete && (
                  <Box className={`flex flex-col items-center mt-4 animate-fadeIn`}>
                    <Badge variant="surface" color='lime' size={'1'} className='w-32'>
                      <p className="font-OS_mono_regular text-xs whitespace-nowrap m-auto">
                        Soul Expired
                      </p>
                    </Badge>
                  </Box>

                )}
                {/* Code Update Badge ----------------------------------------------------------- */}
                <div className="flex flex-col items-center">
                  <DebugCodeUpdateBadge events={chatMessages} />
                </div>
                <div className="min-h-[10px]" />
                <div ref={bottomOfChat} />

              </div>

              {/* Bottom of Chat - Input ----------------------------------------------------------- */}
              {!state?.complete && (
                <div className="relative py-2">
                  {isChatScrolled && <div className="absolute inset-x-0 top-[-3em] flex flex-col items-center">
                    <Button variant='soft' className="mx-auto" onClick={() => scrollToBottom(textBoxRef)}>
                      <FaArrowDown />
                    </Button>
                  </div>}
                  <DebugPerceptionEditor
                    key={chatSettings.sendAsUser ? 'user' : 'soul'}
                    hasState={state?.attributes !== undefined}
                    open={chatSettings.perceptionEditor}
                    canChat={canChat}
                    defaultUser={defaultUserPerception}
                    defaultSoul={loadedSoulPerception}
                    chatSettings={chatSettings}
                    setChatSettings={setChatSettings}
                  />
                  <div className={`duration-200 flex gap-4 my-2 ${disableMessageInput ? 'opacity-50' : 'opacity-100'} items-center`}>
                    <TextField.Root className="flex flex-row grow rounded-sm nodrag align-middle items-center justify-between">
                      <TextField.Input
                        size="3"
                        placeholder={chatSettings.sendAsUser ? 'Send message to soul...' : 'Send spoofed message to client...'}
                        value={messageInput}
                        color={chatSettings.sendAsUser ? "indigo" : "lime"}
                        onChange={(evt) => setUserMessage(evt.target.value)}
                        disabled={disableMessageInput}
                        onKeyDown={(evt) => {
                          if (evt.key === "Enter" && !disableSendWithEnter) {
                            send();
                          }
                        }}
                      />
                      <Button
                        className="z-50"
                        variant={chatSettings.perceptionEditor ? 'soft' : 'surface'}
                        color={chatSettings.perceptionEditor ? chatSettings.sendAsUser ? 'indigo' : 'lime' : 'gray'}
                        tabIndex={-1}
                        size={'1'}
                        mx={'2'}
                        onClick={togglePerception}
                      >
                        <Pencil2Icon />
                      </Button>
                    </TextField.Root>
                    <Button
                      className=""
                      size="3"
                      variant="solid"
                      color={chatSettings.sendAsUser ? "indigo" : "lime"}
                      onClick={send}
                      disabled={disableSendButton}
                    >
                      <FaArrowUp size="14" />
                    </Button>

                  </div>
                </div>
              )}

              {/* END OF ALL CHAT */}
            </div>
          </div>
        </ResizablePanel>
        <PanelResizeHandle className={`${showSidebar ? "block" : "hidden"}`} style={{ borderLeft: "1px dashed var(--gray-5)" }} />
        <ResizablePanel className={`${showSidebar ? "block" : "hidden"}`} order={2} minSize={30} defaultSize={40}>
          <div
            className="flex flex-col h-full w-full"
          >
            <Tabs.Root
              className="flex-col hidden md:flex"
              defaultValue="tab1"
              onValueChange={(value) => setTab(value)}
            >
              <Tabs.List>
                <Tabs.Trigger value="tab1" className="text-slate-400">
                  Process State
                </Tabs.Trigger>
                <Tabs.Trigger value="tab2" className="text-slate-400" onClick={() => { handleScroll(memBoxRef, setIsMemScrolled) }}>
                  Working Memory
                </Tabs.Trigger>
              </Tabs.List>

              {/* Start Subroutine State Content */}
              <Tabs.Content
                className="grow text-sm font-OS_bold leading-relaxed overflow-y-auto hide-scrollbar pl-4 pr-4"
                style={{ maxHeight: "100vh", marginTop: 24 }}
                value="tab1"
                forceMount={true}
                hidden={tab !== "tab1"}
              >
                <fieldset className="mb-16 w-full flex flex-col justify-start overflow-y-auto hide-scrollbar pb-12">
                  <div className="w-full flex flex-col justify-start">
                    <div className="flex flex-row" style={{ height: 20 }}>
                      <label
                        className="text-sm leading-none text-slate-400 block w-[150px]"
                        htmlFor="CodeUpdatedAt"
                      >
                        Last Updated
                      </label>
                    </div>
                    {lastCodeUpdate === metadata?.codeUpdatedAt && (
                      <MemoryCell
                        key="codeUpdatedAt"
                        state={humanReadableDate(metadata?.codeUpdatedAt)}
                        index="Code"
                        animation={metadata?.codeUpdatedAt ? "popInOut 0.5s" : "none"}
                      />
                    )}
                    {metadata?.ragUpdatedAt && (
                      <MemoryCell
                        key="ragUpdatedAt"
                        state={humanReadableDate(metadata?.ragUpdatedAt)}
                        index="RAG"
                      />
                    )}
                  </div>
                  <Separator.Root
                    className="SeparatorRoot"
                    decorative
                    orientation="horizontal"
                    style={{ margin: "20px 0px", marginTop: 15 }}
                  />

                  <div
                    style={{ marginTop: 3 }}
                    className="mb-2 w-full flex flex-col justify-start"
                  >
                    <div className="flex flex-row justify-between">
                      <label
                        className="text-sm leading-none mb-2.5 text-slate-400 block"
                        htmlFor="mentalProcess"
                      >
                        Mental Process
                      </label>
                      {isRunningMainThread && (
                        <Button
                          size="1"
                          variant="outline"
                          ml="2"
                          mt="-1"
                          style={{ pointerEvents: "none" }}
                        >
                          Running
                        </Button>
                      )}
                    </div>
                    <MemoryCell
                      state={state?.currentProcess || "<soul_awakened>"}
                      index={"name"}
                    />
                    <MemoryCell
                      state={state?.currentProcessData || {}}
                      index={"parameters"}
                    />
                    <MemoryCell
                      state={state?.currentMentalProcessInvocationCount || 0}
                      index={"invocationCount"}
                    />
                  </div>

                  <div className="mb-4 w-full flex flex-col justify-start">
                    <div className="flex flex-row mb-2">
                      <label
                        className="text-xs leading-none text-slate-500 block w-[127px] mt-1"
                        htmlFor="processMemory"
                      >
                        processMemories
                      </label>
                      {processState.length === 0 && <label
                        className="font-OS_mono_regular text-xs pl-5"
                      >
                        []
                      </label>}
                    </div>
                    {processState.map((s, index) => (
                      <MemoryCell key={"process" + index} state={s} index={index} />
                    ))}
                  </div>

                  <Separator.Root
                    className="SeparatorRoot border-zinc-900"
                    decorative
                    orientation="horizontal"
                    style={{ margin: "20px 0px", marginTop: 10, marginBottom: 25 }}
                  />
                  <div
                    style={{ marginTop: 0 }}
                    className="mb-4 w-full flex flex-col justify-start"
                  >
                    <div className="flex flex-row justify-between">
                      <label
                        className="text-sm leading-none mb-2 text-slate-400 block"
                        htmlFor="subprocessMemory"
                      >
                        Subprocess
                      </label>
                      {isRunningSubprocess && (
                        <Button
                          size="1"
                          variant="outline"
                          ml="2"
                          mt="-1"
                          style={{ pointerEvents: "none" }}
                        >
                          Running
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-row mb-2 mt-1">
                      <label
                        className="text-xs leading-none text-slate-500 block w-[127px] mt-1"
                        htmlFor="processMemory"
                      >
                        processMemories
                      </label>
                      {subprocessStates.length === 0 && <label
                        className="font-OS_mono_regular text-xs pl-5"
                      >
                        []
                      </label>}
                    </div>
                    {subprocessStates.map((s, index) => (
                      <MemoryCell
                        key={"subprocess" + index}
                        state={s[1]}
                        index={s[0] as string}
                      />
                    ))}
                  </div>

                  <Separator.Root
                    className="SeparatorRoot"
                    decorative
                    orientation="horizontal"
                    style={{ margin: "20px 0px", marginTop: 10, marginBottom: 25 }}
                  />
                  <div
                    style={{ marginTop: 0 }}
                    className="mt-2 mb-4 w-full flex flex-col justify-start"
                  >
                    <label
                      className="text-sm leading-none mb-2 text-slate-400 block"
                      htmlFor="processParameters"
                    >
                      Soul
                    </label>
                    <div className="flex flex-row mb-2 mt-1">
                      <label
                        className="text-xs leading-none text-slate-500 block w-[127px] mt-1"
                        htmlFor="processMemory"
                      >
                        soulMemories
                      </label>
                      {soulMemories.length === 0 && <label
                        className="font-OS_mono_regular text-xs pl-5"
                      >
                        []
                      </label>}
                    </div>
                    {soulMemories.map((e) => (
                      <MemoryCell
                        key={"soul" + e.key}
                        state={e.value}
                        index={e.key}
                      />
                    ))}
                    <div className="flex flex-row mb-2 mt-2">
                      <label
                        className="text-xs leading-none text-slate-500 block w-[127px] mt-1"
                        htmlFor="processMemory"
                      >
                        soulStoreMemories
                      </label>
                      {soulStore.length === 0 && <label
                        className="font-OS_mono_regular text-xs pl-5"
                      >
                        []
                      </label>}
                    </div>
                    {soulStore.map((e) => (
                      <MemoryCell
                        key={"soulStore" + e.key}
                        state={e.value}
                        index={e.key}
                      />
                    ))}
                  </div>

                  <Separator.Root
                    className="SeparatorRoot"
                    decorative
                    orientation="horizontal"
                    style={{ margin: "20px 0px", marginTop: 10, marginBottom: 25 }}
                  />
                  <div
                    style={{ marginTop: 0 }}
                    className="mt-2 mb-4 w-full flex flex-col justify-start"
                  >
                    <label
                      className="text-sm leading-none mb-2 text-slate-400 block"
                      htmlFor="processParameters"
                    >
                      Scheduled Events
                    </label>
                    <div className="flex flex-row mb-2 mt-1">
                      <label
                        className="text-xs leading-none text-slate-500 block w-[127px] mt-1"
                        htmlFor="processMemory"
                      >
                        queue
                      </label>
                      {pendingScheduledEvents.length === 0 && <label
                        className="font-OS_mono_regular text-xs pl-5"
                      >
                        []
                      </label>}
                    </div>
                    {pendingScheduledEvents.map((e) => {
                      return (
                        <CountingDownEvents
                          key={"pendingEvents-outer" + e.key}
                          index={e.key}
                          stateString={`${JSON.parse(JSON.stringify(e.value)).process}`}
                        />
                      )
                    })}
                  </div>
                  <Separator.Root
                    className="SeparatorRoot"
                    decorative
                    orientation="horizontal"
                    style={{ margin: "20px 0px", marginTop: 10, marginBottom: 25 }}
                  />
                  <div
                    style={{ marginTop: 0 }}
                    className="mt-2 mb-4 w-full flex flex-col justify-start"
                  >
                    <label
                      className="text-sm leading-none mb-2 text-slate-400 block"
                      htmlFor="environment"
                    >
                      Environment
                    </label>

                    <div className="flex flex-row mb-2">
                      <label
                        className="text-xs leading-none text-slate-500 block w-[147px] mt-1"
                        htmlFor="processMemory"
                      >
                        variables
                      </label>
                      {environmentVariables.length === 0 && <label
                        className="font-OS_mono_regular text-xs"
                      >
                        []
                      </label>}
                    </div>
                    {environmentVariables.map((e) => (
                      <MemoryCell
                        key={"environmentVariables" + e.key}
                        state={e.value}
                        index={e.key}
                      />
                    ))}
                  </div>
                  <div style={{ height: 100 }}></div>
                </fieldset>
              </Tabs.Content>

              {/* Start Working Memory Content */}
              <Tabs.Content
                className="grow text-sm font-OS_bold leading-relaxed px-4"
                value="tab2"
                forceMount={true}
                hidden={tab !== "tab2"}
              >
                <fieldset className="pt-2 mb-16 w-full flex flex-col justify-start">
                  <div className="flex pt-2 flex-col h-[85vh] overflow-hidden">
                    {(state.commits?.length || 0) > 0 && <Text
                      style={{ marginTop: -5, marginBottom: 8 }}
                      className="text-xs font-OS_bold text-lime-600"
                    >
                      Commits
                    </Text>}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {(state.commits || []).map((s, index) => (
                        <Button
                          size={"1"}
                          key={`memory-selector-${index}`}
                          color={JSON.stringify((state.commits || [])[index - 1]?.memories) === JSON.stringify(s.memories) ? "gray" : undefined}
                          variant={index === selectedCommitIndex ? "solid" : "outline"}
                          onClick={() => setSelectedCommitIndex(index)}
                          className="align-left"
                        >
                          <p className=" font-mono font-light text-xs tracking-tight">
                            {index === 0 ? "Memory Integrator" : index === 1 ? "Main Thread" : `Subprocess ${s.process}`}
                          </p>
                        </Button>
                      ))}
                      {(isRunningMainThread || isRunningSubprocess) && <Button
                        size={"1"}
                        key={`running`}
                        color={"green"}
                        variant={"outline"}
                      >
                        Running
                      </Button>}
                      <div className="mb-1" />
                    </div>
                    {(state.commits?.length || 0) > 0 &&
                      <Text
                        style={{ marginTop: -5, marginBottom: 8 }}
                        className="text-xs font-OS_bold text-lime-600"
                      >
                        State
                      </Text>}
                    <ScrollArea
                      type="always"
                      scrollbars="vertical"
                      onScroll={() => handleScroll(memBoxRef, setIsMemScrolled)}
                      ref={memBoxRef}
                      className="relative"
                    >
                      <div className="flex flex-col mb-4 mr-4 gap-1">
                        {commit?.memories?.reduce<JSX.Element[]>((acc, m, i, arr) => {
                          const prevMessage = arr[i - 1];
                          const currentRegion = m.region || "default";
                          const firstOfRegion = currentRegion !== (prevMessage?.region || "default") || (i === 0);

                          if (firstOfRegion) {
                            acc.push(
                              <RegionHeader
                                regionName={currentRegion}
                                className="w-full"
                                key={`region-${acc.length}`}
                                data-region={currentRegion}
                              >
                                {[]}
                              </RegionHeader>
                            );
                          }

                          acc[acc.length - 1].props.children.push(
                            <WorkingMemoryDivider message={m} index={i} showRegion={firstOfRegion} key={`chat-message-${i}-i`} />
                          );

                          return acc;
                        }, []).map((regionGroup) => regionGroup)}
                      </div>
                      {isMemScrolled && (
                        <div className="absolute inset-x-0 bottom-4 flex flex-col items-center">
                          <Button variant="soft" color="lime" className="mx-auto" onClick={() => scrollToBottom(memBoxRef)}>
                            <FaArrowDown />
                          </Button>
                        </div>
                      )}
                      <div ref={bottomOfWorkingMem} className="w-full" />
                    </ScrollArea>
                  </div>
                </fieldset>
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </ResizablePanel>
      </PanelGroup>
    </div>

  );
};

export default DebugChat;
