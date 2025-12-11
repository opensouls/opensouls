import { SoulEvent, SoulEventKinds } from "@opensouls/engine";
import { ArrowRightIcon, ResetIcon } from "@radix-ui/react-icons";
import { Box, Button, TextField, Select, Tooltip, Badge } from "@radix-ui/themes";

import { useCallback, useEffect, useState } from "react";
import { RxCode, RxLightningBolt, RxPerson } from "react-icons/rx";
import { ChatSettings } from "@/components/DebugChat";
import { FaSave } from "react-icons/fa";

export type CustomPerception = Omit<SoulEvent, "content" | "_id" | "_timestamp"> & {

}

export type PerceptionEditorProps = {
    hasState: boolean;
    open: boolean;
    canChat: boolean;
    defaultUser: CustomPerception;
    defaultSoul: CustomPerception;
    chatSettings: ChatSettings;
    setChatSettings: (value: (last: ChatSettings) => ChatSettings) => void;
}

export default function DebugPerceptionEditor({ hasState, open, canChat, defaultUser, defaultSoul, chatSettings, setChatSettings }: PerceptionEditorProps) {

    const perception = chatSettings.sendAsUser ? chatSettings.userPerception : chatSettings.soulPerception;
    const defaultPerception = chatSettings.sendAsUser ? defaultUser : defaultSoul;
    const canReset = JSON.stringify(perception) !== JSON.stringify(defaultPerception);

    const [metadata, setMetadata] = useState<string>(JSON.stringify(perception?._metadata) ?? '');
    const [isValidMetadata, setIsValidMetadata] = useState(true);

    const needPerception = !hasState && !chatSettings.sendAsUser;
    
    const setPerception = useCallback((p: CustomPerception) => {
        const perceptionKey = chatSettings.sendAsUser ? 'userPerception' : 'soulPerception';
        setChatSettings((prev: ChatSettings) => ({
            ...prev,
            [perceptionKey]: p
        }));
    }, [chatSettings.sendAsUser, setChatSettings]);

    function changePerception(values: Partial<CustomPerception>) {
        setPerception({ ...perception, ...values });
    }

    function reset() {
        setPerception({ ...defaultPerception });
        setMetadata(JSON.stringify(defaultPerception._metadata) ?? '');
        setIsValidMetadata(true);
    }

    function handleMetadataChange(value: string) {
        if (!value) {
            setIsValidMetadata(true);
            setMetadata('');
            changePerception({ _metadata: undefined });
            return;
        }

        setMetadata(value);

        try {
            const parsedValue = JSON.parse(value);
            changePerception({ _metadata: parsedValue });
            setIsValidMetadata(true);
        } catch (error) {
            changePerception({ _metadata: undefined });
            setIsValidMetadata(false);
        }
    }

    return (
        <div className={`relative w-full flex flex-row justify-between ${canChat ? 'opacity-100' : 'opacity-50'} ${open ? 'visible' : 'invisible'} whitespace-nowrap`}>
            {needPerception && <div className="absolute w-full flex flex-col justify-center animate-fadeIn top-[-2em]">
                <Badge variant="surface" size={'1'} color="gray" className="w-min font-mono text-xs mx-auto">Please send an initial Interlocutor perception.</Badge>
            </div>}
            <Box className={`w-full flex flex-row gap-2 justify-between font-mono`}>
                <div className={`flex flex-row gap-2 ${needPerception && 'opacity-50'}`}>
                    <TextField.Root className={`rounded-sm nodrag items-center gap-2 px-2`}>
                        <TextField.Input
                            className={`max-w-32 `}
                            size="1"
                            placeholder="name"
                            value={perception.name}
                            variant={chatSettings.sendAsUser ? 'surface' : 'soft'}
                            color={perception.name ? (chatSettings.sendAsUser ? 'indigo' : 'lime') : 'red'}
                            onChange={(evt) => { if (!chatSettings.sendAsUser) return; changePerception({ name: evt.target.value }) }}
                        />
                        <RxPerson size={'14'} className={perception.name ? (chatSettings.sendAsUser ? 'text-indigo-400' : 'text-lime-400') : 'text-red-400'} />
                    </TextField.Root>
                    <TextField.Root className="rounded-sm nodrag items-center gap-2 px-2">
                        <TextField.Input
                            className="max-w-32"
                            size="1"
                            placeholder="action"
                            value={perception.action}
                            color={perception.name ? (chatSettings.sendAsUser ? 'indigo' : 'lime') : 'red'}
                            onChange={(evt) => changePerception({ action: evt.target.value })}
                        />
                        <RxLightningBolt size={'14'} className={perception.action ? (chatSettings.sendAsUser ? 'text-indigo-400' : 'text-lime-400') : 'text-red-400'} />
                    </TextField.Root>
                    <TextField.Root className="rounded-sm nodrag items-center gap-2 px-2">
                        <TextField.Input
                            className="max-w-16"
                            size="1"
                            placeholder="metadata"
                            value={metadata}
                            color={isValidMetadata ? (chatSettings.sendAsUser ? 'indigo' : 'lime') : 'red'}
                            onChange={(evt) => handleMetadataChange(evt.target.value)}

                        />
                        <RxCode size={'14'} className={isValidMetadata ? (chatSettings.sendAsUser ? 'text-indigo-400' : 'text-lime-400') : 'text-red-400'} />
                    </TextField.Root>
                    {canReset && <Button
                        variant="surface"
                        color='gray'
                        size={'1'}
                        tabIndex={-1}
                        onClick={reset}
                    >
                        <ResetIcon />
                    </Button>}
                </div>

                <div className="flex flex-row gap-2">
                    {chatSettings.sendAsUser ? (
                        null
                    ) : (
                        <Tooltip content={'Save to Working Memory'}>
                            <Button
                                variant={'surface'}
                                size={'1'}
                                color={chatSettings.saveToMemory ? 'lime' : 'gray'}
                                tabIndex={-1}
                                onClick={() => setChatSettings((last:ChatSettings) => ({ ...last, saveToMemory: !last.saveToMemory }))}
                            >
                                <FaSave />
                            </Button>
                        </Tooltip>
                    )}
                    <Button
                        className={`flex flex-row gap-2 whitespace-nowrap overflow-hidden max-w-48 ${needPerception && 'animate-pulse'}`}
                        variant="surface"
                        size={'1'}
                        color={chatSettings.sendAsUser ? 'indigo' : 'lime'}
                        tabIndex={-1}
                        onClick={() => setChatSettings((last:ChatSettings) => ({ ...last, sendAsUser: !last.sendAsUser }))}
                    >
                        <p>{chatSettings.sendAsUser ? 'Client' : 'Soul'}</p>
                        <ArrowRightIcon />
                        <p>{chatSettings.sendAsUser ? 'Soul' : 'Client'}</p>
                    </Button>
                    {/* <DebugSoulEventKinds perception={perception} setPerception={setPerception} reset={reset} /> */}
                </div>

            </Box >
        </div >
    )
}

export function DebugSoulEventKinds({ perception, setPerception }: { perception: CustomPerception, setPerception: (value: Partial<CustomPerception>) => void }) {

    return (
        <div className="flex flex-row gap-2 items-center font-mono text-xs">
            <p className='text-zinc-400'>Send as</p>
            <Select.Root
                defaultValue={perception._kind}
                size={'1'}
                onValueChange={(s) => setPerception({ _kind: s as SoulEventKinds })}
            >
                <Select.Trigger />
                <Select.Content>
                    <Select.Group className="font-mono">
                        <Select.Label>SoulEventKinds</Select.Label>
                        <Select.Item value={SoulEventKinds.Perception}>Perception</Select.Item>
                        <Select.Item value={SoulEventKinds.InteractionRequest}>Request</Select.Item>
                        <Select.Item value={SoulEventKinds.System}>System</Select.Item>
                    </Select.Group>
                </Select.Content>
            </Select.Root>
        </div>
    )
}