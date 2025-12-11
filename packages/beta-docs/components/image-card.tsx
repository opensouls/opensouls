import Image from "next/image";

type ImageCardProps = {
  title: string;
  src?: string;
  href: string;
  alt?: string;
};

export default function ImageCard({ title, src, href, alt }: ImageCardProps) {
  return (
    <a className="relative h-[300px]" href={href}>
      {src ? (
        <Image src={src} alt={alt ?? title} fill className="object-cover object-top" />
      ) : (
        <div className="flex w-full h-full items-center justify-center">
          <Image src="/images/logo_mark.svg" width={40} height={40} alt="OpenSouls Logo" />
        </div>
      )}
      <div className="absolute w-full min-h-16 bottom-0 bg-gradient-to-t from-black/100 via-black/60 to-black/0 flex items-end">
        <p className="px-6 py-5 text-white font-bold">{title}</p>
      </div>
    </a>
  );
}
