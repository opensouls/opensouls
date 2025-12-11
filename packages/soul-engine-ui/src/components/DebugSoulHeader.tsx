import { useState } from "react";
import { Text } from "@radix-ui/themes";
import { FaCircleDot } from "react-icons/fa6";
import { PageData, PageState } from "@/components/DebugChat";


const headerText: Record<PageState, string> = {
    'pending': 'Soul Loading',
    'auth-mismatch': 'Soul Hibernating',
    'error': 'Soul Error',
    'connected': 'Soul Awakened',
    'disconnected' : 'Soul Disconnected',
}

const headerColor: Record<PageState, string> = {
    'pending': 'text-lime-600',
    'auth-mismatch': 'text-yellow-600',
    'error': 'text-red-500',
    'connected': 'text-lime-600',
    'disconnected': 'text-yellow-600',
}

export default function DebugSoulHeader({
    organizationId,
    subroutineId,
    pageState,
}: {
    organizationId: string,
    subroutineId: string,
    pageState: PageData,
}) {

    return (
        <div className="flex flex-col items-center gap-0">
            <div className="flex flex-row items-center justify-center mb-1">
                <FaCircleDot className={`${headerColor[pageState.state]} w-4 h-4 pr-2 animate-ping`} />
                <Text className={`${headerColor[pageState.state]} text-sm tracking-loose font-OS_mono_bold`}>
                    {headerText[pageState.state]}
                </Text>
            </div>

            <Text
                className=""
                style={{
                    fontSize: 12,
                    color: "var(--gray-11)",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                }}
            >
                {organizationId}/{subroutineId}
            </Text>

            {pageState.text && <Text
                className="opacity-50"
                style={{
                    fontSize: 12,
                    marginTop: 24,
                    color: "var(--gray-11)",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                }}
            >
                {pageState.text}
            </Text>}
        </div>
    )
}