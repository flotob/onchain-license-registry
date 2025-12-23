import { NavLink } from "react-router";
import { FaHome } from "react-icons/fa";
import { HiPencilAlt, HiShieldCheck } from "react-icons/hi";
import { Divider } from "./Divider";

type Props = {
    onSelect: () => void;
}

export default function Menu(props: Props) {
    const { onSelect } = props;

    return <nav className="flex flex-col gap-2">
        <div className="bg-bg-surface p-2 rounded self-start gap-1 w-full shadow-lg">
            <NavLink
                to="/"
                className={({ isActive }) => 
                    isActive 
                        ? "flex flex-row gap-2 items-center rounded py-2 px-4 bg-accent text-text-inverted" 
                        : "flex flex-row gap-2 items-center rounded py-2 px-4 text-text-primary hover:bg-bg-elevated"
                }
                onClick={onSelect}
            >
                <FaHome />
                View Registry
            </NavLink>
        </div>
        <div className="bg-bg-surface p-2 rounded self-start gap-1 w-full shadow-lg">
            <Divider className="mt-1 mb-2">Actions</Divider>
            <NavLink
                to="/admin"
                className={({ isActive }) => 
                    isActive 
                        ? "flex flex-row gap-2 items-center rounded py-2 px-4 bg-accent text-text-inverted" 
                        : "flex flex-row gap-2 items-center rounded py-2 px-4 text-text-primary hover:bg-bg-elevated"
                }
                onClick={onSelect}
            >
                <HiPencilAlt />
                Create Entry
            </NavLink>
            <NavLink
                to="/verify"
                className={({ isActive }) => 
                    isActive 
                        ? "flex flex-row gap-2 items-center rounded py-2 px-4 bg-accent text-text-inverted" 
                        : "flex flex-row gap-2 items-center rounded py-2 px-4 text-text-primary hover:bg-bg-elevated"
                }
                onClick={onSelect}
            >
                <HiShieldCheck />
                Verify Update
            </NavLink>
        </div>
    </nav>;
}
