"server-only";
import BackgroundImage from "@/components/BackgroundImage";
import { getLocalOrganizationSlug } from "@/lib/localAuth";
import { Table } from "@radix-ui/themes";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Usage() {
  const organizationSlug = await getLocalOrganizationSlug()
  if (!organizationSlug) {
    return redirect("/auth?next=/usage")
  }
  
  const usage_summary = [
    { model: "demo", total_input_tokens: 0, total_output_tokens: 0 },
  ]

  const usage_events: Array<{ model: string; input: number; output: number; created_at: string }> = []


  return (
    <BackgroundImage imageUrl="/images/login_world.webp">
      <div className="flex h-[100vh] flex-col items-center justify-center">
        <div className="fadeIn m-2 border border-zinc-300/20 bg-zinc-700/50 p-4 pb-8 pt-8 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center">
            <Image
              className="ml-4 mr-4 pb-2"
              src="/logo_mark.svg"
              width={30}
              height={16}
              alt="Open Souls logo"
            />
            <Image
              className="ml-4 mr-4 pb-2 "
              src="/logo_type.svg"
              width={150}
              height={16}
              alt="Open Souls logo"
            />
            <div className="mt-1 flex justify-center font-OS_bold text-xl text-zinc-300">
              {organizationSlug}
            </div>
          </div>
          <div>
            <div className="my-4 flex justify-center font-OS_bold text-4xl text-zinc-300">
                Summary
            </div>
            <div className="fadeIn ml-4 mr-4 mt-4 flex justify-center">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Input Tokens (Total)</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Output Tokens (Total)</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Credits</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {usage_summary.map((summary, iterator) => { 
                  return(                
                    <Table.Row key={iterator}>
                      <Table.RowHeaderCell><b>{summary.model}</b></Table.RowHeaderCell>
                      <Table.Cell><b>{summary.total_input_tokens}</b></Table.Cell>
                      <Table.Cell><b>{summary.total_output_tokens}</b></Table.Cell>
                      <Table.Cell><b>?</b></Table.Cell>
                    </Table.Row>
                  ) 
                })}
              </Table.Body>
            </Table.Root>
          </div>
          </div>
          <div>
            <div className="my-4 flex justify-center font-OS_bold text-4xl text-zinc-300">
                Token Usage
            </div>
            <div className="fadeIn ml-4 mr-4 mt-4 flex justify-center">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Input Tokens</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Output Tokens</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Timestamp</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {usage_events.map((event, iterator) => {
                  return (
                    <Table.Row key={iterator}>
                      <Table.RowHeaderCell>{event.model}</Table.RowHeaderCell>
                      <Table.Cell>{event.input}</Table.Cell>
                      <Table.Cell>{event.output}</Table.Cell>
                      <Table.Cell>{event.created_at}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </div>
          </div>
        </div>
      </div>
    </BackgroundImage>
  );
}
