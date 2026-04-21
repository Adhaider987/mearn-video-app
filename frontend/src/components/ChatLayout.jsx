import { Outlet, useOutletContext } from "react-router-dom";
import FriendsSidebar from "./FriendsSidebar";

const ChatLayout = () => {
  const context = useOutletContext();
  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <FriendsSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--code-bg)' }}>
        <Outlet context={context} />
      </div>
    </div>
  );
};

export default ChatLayout;
