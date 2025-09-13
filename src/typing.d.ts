
type SideBarItem = {
    label: string,
    key: string,
    icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>
}

type Conversation = {
    id: string
    title: string
    createdAt: string
}

type Message = {
    content: string;
    files?: File[];
    isUser: boolean;
    isError?: boolean;
    timestamp: number;
    id: string;
    end?: boolean;
}