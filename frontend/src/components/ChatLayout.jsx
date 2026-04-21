import { Outlet, useOutletContext, useParams } from "react-router-dom";
import FriendsSidebar from "./FriendsSidebar";

const ChatLayout = () => {
  const { friendId } = useParams();
  const context = useOutletContext();
  
  return (
    <div className="chat-layout" style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <div className={`friends-list-container ${friendId ? 'hidden-mobile' : 'full-mobile'}`} style={{ display: 'flex' }}>
        <FriendsSidebar />
      </div>
      <div className={`chat-area-container ${!friendId ? 'hidden-mobile' : 'full-mobile'}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--code-bg)' }}>
        <Outlet context={context} />
      </div>
    </div>
  );
};

export default ChatLayout;
