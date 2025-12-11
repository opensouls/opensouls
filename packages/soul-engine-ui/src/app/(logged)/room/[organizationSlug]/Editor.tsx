"use client";

import { useCallback, useState, useMemo, Fragment, useRef, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import DebugChat from "@/components/DebugChat";
import { Theme, Box, Grid, Select, TextField, Badge, Button, Text, TextArea, ScrollArea } from "@radix-ui/themes";
import { Cross1Icon, PlusIcon, WidthIcon } from "@radix-ui/react-icons";
import VerticalSidebar from "@/components/VerticalSidebar";
import { SoulOpts } from "@opensouls/soul";
import { SoulEngineProvider, useSharedContext, SharedContextProvider } from "@opensouls/react";
import { Json } from "@opensouls/core";
import { MemoryCell, EntryProps } from "@/components/MemoryCell";
import LoggedUserDropdownMenu from "@/components/LoggedUserDropdownMenu";
import { useHover } from '@uidotdev/usehooks';
import { getAuthToken } from "@/lib/documentStores";

export type Blueprint = {
    slug: string;
    enforce_jwt: boolean;
};

export type EditorType = {
    editorType: "blueprint" | "shared-context";
    minWidth: number;
    maxWidth: number;
    uniqueId: string;
}

export const BlueprintWindow: Omit<EditorType, "uniqueId"> = {
    editorType: "blueprint",
    minWidth: 500,
    maxWidth: 770,
}

export const SharedContextWindow: Omit<EditorType, "uniqueId"> = {
    editorType: "shared-context",
    minWidth: 500,
    maxWidth: 770,
}

type BlueprintProps = SoulOpts & { soulId: string } & EditorType;
type SharedContextProps = SoulOpts & { soulId: string } & EditorType;
type WindowEditorTypes = BlueprintProps | SharedContextProps;

export type InterfaceSettings = {
    organizationId: string;
    blueprint: string;
    soulId: string;
    uniqueId: string;
    windows: WindowEditorTypes[];
};

type SoulOptsWithID = SoulOpts & { soulId: string };

export const Editor = ({ blueprints, params, souls, contexts }: {
    params: { organizationSlug: string },
    blueprints: Blueprint[];
    souls: SoulOptsWithID[];
    contexts: SoulOptsWithID[];
}) => {

    console.log('souls', souls);
    console.log('sharedContexts', contexts);

    const [windows, setWindows] = useLocalStorage<WindowEditorTypes[]>(`windows`, []);

    const sortedWindows = useMemo(() => windows.sort((a, b) => {
        // First, compare by blueprint
        const blueprintComparison = a.blueprint.localeCompare(b.blueprint);
        if (blueprintComparison !== 0) {
            return blueprintComparison;
        }
        // If blueprints are the same, compare by soulId
        return a.soulId.localeCompare(b.soulId);
    }), [windows]);
    const [panel, setPanel] = useLocalStorage<InterfaceSettings>(`interfaceSettings`, {
        organizationId: params.organizationSlug as string,
        blueprint: blueprints[0].slug,
        soulId: 'soul-1',
        uniqueId: '',
        windows: [],
    });

    useEffect(() => {
        souls.forEach((soul) => {
            addBlueprint(soul.blueprint, soul.soulId);
        });
        contexts.forEach((context) => {
            addSharedContext(context.organization, context.blueprint, context.soulId);
        });
    }, [souls, contexts]);

    const selectBlueprint = useCallback((blueprint: string) => {
        setPanel({ ...panel, blueprint: blueprint });
    }, [panel]);

    function closeWindow(index: number) {
        setWindows(windows.filter((_, i) => i !== index));
    }

    function addBlueprint(blueprint: string, soulId: string) {

        setWindows((prevWindows) => {
            if (prevWindows.some((window) => window.editorType === "blueprint" && window.uniqueId === makeIdentifier({ blueprint, soulId, organization: params.organizationSlug as string }))) {
                return prevWindows;
            }
            return [...prevWindows, {
                ...BlueprintWindow,
                organization: params.organizationSlug as string,
                uniqueId: makeIdentifier({ blueprint, soulId, organization: params.organizationSlug as string }),
                blueprint,
                soulId,
            } as BlueprintProps]
        });
    }

    async function addSharedContext(organization: string, blueprint: string, soulId: string, uniqueId?: string) {

        try {
            const sharedContextName = makeIdentifier({ blueprint, soulId, organization }, uniqueId);
            setWindows((prevWindows) => {
                if (prevWindows.some((window) => window.editorType === "shared-context" && window.uniqueId === makeIdentifier({ blueprint, soulId, organization }, uniqueId))) {
                    return prevWindows;
                }
                return [...prevWindows, {
                    ...SharedContextWindow,
                    organization: params.organizationSlug as string,
                    uniqueId: sharedContextName,
                    blueprint,
                    soulId,
                } as SharedContextProps]
            });

        } catch (error) {
            console.error("Error creating shared context token", error);
        }
    }

    const sharedContextTokens = useMemo(() =>
        Object.assign({}, ...windows
            .filter((window) => window.editorType === "shared-context")
            .map((window) => {
                const sharedContextWindow = window as SharedContextProps
                const sharedContextName = makeIdentifier(sharedContextWindow);
                return { [sharedContextName]: getAuthToken };
            })
        ), [windows]);


    const disableAdd = !panel.soulId;

    return (
        <Theme>
            <SharedContextProvider
                organization={params.organizationSlug}
                tokens={sharedContextTokens}
                local={process.env.NEXT_PUBLIC_SOUL_ENGINE_LOCAL === "true"}
            >
                <div className="h-screen w-screen overflow-hidden" >
                    <Box
                        style={{
                            gridColumn: "1 / 2",
                            gridRow: "1 / 3",
                        }}
                    >
                        <VerticalSidebar text="Editor" />
                    </Box>
                    <Box className="pl-12 w-full h-full flex flex-col">
                        <div className="flex flex-row items-center p-3 gap-2 justify-between border-b border-slate-700">
                            <div className="flex flex-row gap-2 items-center">
                                <div className="flex flex-row gap-2 items-center font-mono text-xs">
                                    <TextField.Root size="1">
                                        <TextField.Input
                                            placeholder="Organization"
                                            value={panel.organizationId}
                                            disabled
                                        />
                                    </TextField.Root>
                                    <Select.Root size="1" value={panel.blueprint} onValueChange={selectBlueprint}>
                                        <Select.Trigger className="w-32 whitespace-nowrap" placeholder="Select a blueprint" />
                                        <Select.Content>
                                            {blueprints.map((blueprint) => (
                                                <Select.Item key={blueprint.slug} value={blueprint.slug}>
                                                    {blueprint.slug}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                    <TextField.Root size="1">
                                        <TextField.Input
                                            placeholder="Soul ID"
                                            value={panel.soulId}
                                            onChange={(e) => setPanel({ ...panel, soulId: e.target.value })}
                                        />
                                    </TextField.Root>
                                    <TextField.Root size="1">
                                        <TextField.Input
                                            placeholder="ID (optional)"
                                            value={panel.uniqueId}
                                            onChange={(e) => setPanel({ ...panel, uniqueId: e.target.value })}
                                        />
                                    </TextField.Root>
                                    <VerticalSpacer />
                                    <Button
                                        size="1"
                                        variant="soft"
                                        color="indigo"
                                        onClick={() => addBlueprint(panel.blueprint, panel.soulId)}
                                        disabled={disableAdd || windows.some(window => window.editorType === "blueprint" && window.uniqueId === makeIdentifier({ blueprint: panel.blueprint, soulId: panel.soulId, organization: params.organizationSlug as string }, panel.uniqueId))}
                                    >
                                        <PlusIcon />
                                        Soul
                                    </Button>
                                </div>
                                <div className="flex flex-row gap-2 items-center">
                                    <Button
                                        size="1"
                                        variant="soft"
                                        color="orange"
                                        onClick={() => addSharedContext(params.organizationSlug as string, panel.blueprint, panel.soulId, panel.uniqueId)}
                                        disabled={disableAdd || windows.some(window => window.editorType === "shared-context" && window.uniqueId === makeIdentifier({ blueprint: panel.blueprint, soulId: panel.soulId, organization: params.organizationSlug as string }, panel.uniqueId))}
                                    >
                                        <PlusIcon />
                                        Context
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-row gap-4 items-center">
                                <Button
                                    size="1"
                                    color="red"
                                    variant="soft"
                                    onClick={() => setWindows([])}
                                    disabled={windows.length === 0}
                                >
                                    Clear All
                                </Button>
                                <LoggedUserDropdownMenu organizationSlug={params.organizationSlug} />
                            </div>
                        </div>
                        <div className="h-full w-full overflow-x-auto">
                            <div className="h-full min-w-max overflow-x-auto flex flex-row">
                                {sortedWindows.map((window, index) => {
                                    let content = null;
                                    if (window.editorType === "shared-context") {
                                        const sharedContext = window as SharedContextProps;
                                        const token = getAuthToken;
                                        content = (
                                            <SharedContextEditable
                                                sharedContextName={sharedContext.uniqueId}
                                                sharedContextToken={token}
                                            />
                                        )
                                    } else if (window.editorType === "blueprint") {
                                        const blueprint = window as BlueprintProps;
                                        content = (
                                            <ChatColumn
                                                organizationSlug={params.organizationSlug}
                                                subroutineId={blueprint.blueprint}
                                                chatId={blueprint.soulId}
                                            />
                                        )
                                    }

                                    return (
                                        <WindowParent
                                            key={`${window.uniqueId}-${index}`}
                                            window={window}
                                            onClose={() => closeWindow(index)}
                                        >
                                            {content}
                                        </WindowParent>
                                    )
                                })}
                            </div>
                        </div>
                    </Box>

                </div>
            </SharedContextProvider>
        </Theme >
    );
};

function SharedContextEditable({ sharedContextName, sharedContextToken }: {
    sharedContextName: string,
    sharedContextToken?: string | (() => string) | (() => Promise<string>)
}) {
    const state = useSharedContext<Record<string, Json>>(sharedContextName, sharedContextToken);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    const disabled = !newKey.trim();

    const validateKey = (input: string) => {
        // Allow alphanumeric characters, underscores, and dollar signs
        // First character must be a letter, underscore, or dollar sign
        return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(input);
    };

    const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        if (validateKey(input) || input === '') {
            setNewKey(input);
        }
    };

    const addNewPair = () => {
        if (!disabled) {
            state.data[newKey.trim()] = newValue;
            setNewKey('');
            setNewValue('');
        }
    };

    return (
        <ScrollArea className="w-full h-full" scrollbars="vertical">
            <div className="w-full flex flex-col p-3">
                <div className="flex flex-col gap-2 mb-4 p-2">
                    <div className="flex flex-row gap-2">
                        <TextField.Root size="1" className="h-min grow">
                            <TextField.Input
                                placeholder="key"
                                value={newKey}
                                onChange={handleKeyChange}
                            />
                        </TextField.Root>
                        <Button size="1" onClick={addNewPair} disabled={disabled}>
                            <PlusIcon />
                        </Button>
                    </div>
                    <TextArea size="1" className="flex"
                        placeholder="value"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                    />
                </div>
                {Object.entries(state.data).map(([key, value]) => {
                    return (
                        <Fragment key={key}>
                            <MemoryCell
                                state={value}
                                index={key}
                                CustomComponent={SharedContextField}
                                customComponentProps={{ data: state.data, keyName: key }}
                            />
                        </Fragment>
                    )
                })}
            </div>
        </ScrollArea>
    )
}

function SharedContextField({ data, expanded, state, index, ...props }: EntryProps & {
    data: Record<string, Json>,
    keyName: keyof typeof data
}) {

    const [hoverRef, isHovering] = useHover();
    async function setData(value: Json) {
        //TODO: debounce?
        data[index] = value;
    }

    if (typeof data[index] === 'object' && data[index] !== null) return null;

    return (
        <div className="relative" ref={hoverRef}>
            <TextFieldVariable
                state={String(data[index]) ?? state}
                expanded={expanded ?? false}
                onChange={(value) => setData(value as Json)}
            />
            {isHovering && <div
                className="absolute right-6 top-1"
                onClick={() => {
                    delete data[index];
                    // Force a re-render
                    data = { ...data };
                }}
            >
                <Cross1Icon className="w-3 h-3" />
            </div>}
        </div>
    );
}

const TEXT_FIELD_LENGTH = 50
function TextFieldVariable({ state, expanded, onChange }: { state: string, expanded: boolean, onChange: (value: string) => void }) {

    const value = String(state) ?? "";
    const isLongText = value.length > TEXT_FIELD_LENGTH;
    const [isTextArea, setIsTextArea] = useState(isLongText);

    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const textFieldRef = useRef<HTMLInputElement>(null);

    useEffect(() => {

        if (isLongText === isTextArea) return;

        setIsTextArea((prev) => {
            if (isLongText !== isTextArea) {
                if (isLongText) {
                    textAreaRef.current?.focus();
                    textAreaRef.current?.setSelectionRange(value.length, value.length);
                } else {
                    textFieldRef.current?.focus();
                    const input = textFieldRef.current?.querySelector('input');
                    input?.setSelectionRange(value.length, value.length);
                }
            }
            return isLongText
        });
    }, [isLongText, value]);

    return (
        <div>
            {isLongText ? (
                <TextArea
                    size="1"
                    ref={textAreaRef}
                    rows={expanded ? 25 : 5}
                    style={{ resize: 'vertical' }}
                    //TODO UPDATE TO RADIX 3.0
                    // resize="vertical"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            ) : (
                <TextField.Root >
                    <TextField.Input
                        ref={textFieldRef}
                        size="1"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </TextField.Root>
            )}
        </div>
    );
}
export type WindowParentProps = {
    window: WindowEditorTypes;
    onClose: () => void;
    children: React.ReactNode;
}

function WindowParent({ window, onClose, children }: WindowParentProps) {

    const [width, setWidth] = useState<number>(window.minWidth);
    function toggleWidth() {
        setWidth(width === window.minWidth ? window.maxWidth : window.minWidth);
    }

    return (
        <div
            className="border-r border-slate-700 overflow-clip"
            style={{ width: `${width}px` }}
        >
            <div className="h-full w-full flex flex-col">
                <WindowHeader window={window} width={width} toggleWidth={toggleWidth} onClose={onClose} />
                <div className="shrink grow overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}

export type WindowHeaderProps = {
    window: WindowEditorTypes;
    onClose: () => void;
    width: number;
    toggleWidth: () => void;
}

function WindowHeader({ window, onClose, width, toggleWidth }: WindowHeaderProps) {

    return (
        <Theme color="gray">
            <div className="flex flex-row justify-between gap-1 p-2 border-b border-slate-800">
                <div className="flex flex-row gap-1 whitespace-nowrap font-mono text-xs select-all items-center gap-2">
                    <Badge color={window.editorType === "blueprint" ? "indigo" : "orange"}>{`${window.editorType}`}</Badge>
                    <Text size="1" className="opacity-50">{window.uniqueId}</Text>
                </div>
                <div className="flex flex-row gap-1">
                    <Button variant="soft" size="1" onClick={toggleWidth}>
                        {width === window.minWidth ? <WidthIcon /> : <WidthIcon />}
                    </Button>
                    <Button variant="soft" size="1" color="red" onClick={onClose}>
                        <Cross1Icon />
                    </Button>
                </div>
            </div>
        </Theme>

    );
}

function VerticalSpacer() {
    return <div className="h-full w-px mx-1" />;
}
function VerticalSeparator() {
    return <div className="h-full w-px mx-4 border-r border-slate-700" />;
}

function ChatColumn({ organizationSlug, subroutineId, chatId }: { organizationSlug: string, subroutineId: string, chatId: string }) {
    return (
        <div className="h-[87vh]">
            <DebugChat
                organizationSlug={organizationSlug as string}
                subroutineId={subroutineId as string}
                chatId={chatId as string}
            />
        </div>
    );
}

export const makeIdentifier = (soulOpts: SoulOpts & { soulId: string }, uniqueId = ""): string =>
    `${soulOpts.organization}.${soulOpts.blueprint}.${soulOpts.soulId}${uniqueId !== "" ? `.${uniqueId}` : ""}`;
