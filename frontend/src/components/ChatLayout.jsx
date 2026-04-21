import { Outlet, useOutletContext, useParams } from "react-router-dom";
import FriendsSidebar from "./FriendsSidebar";

const ChatLayout = () => {
  const { friendId } = useParams();
  const context = useOutletContext();
  
  return (
    <div className="flex flex-1 h-full overflow-hidden bg-premium-bg">
      {/* Sidebar - Hidden on mobile if a chat is active */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-white/5 ${friendId ? 'hidden md:flex' : 'flex'}`}>
        <FriendsSidebar />
      </div>
      
      {/* Chat Area - Hidden on mobile if NO chat is active */}
      <div className={`flex-1 flex flex-col bg-premium-bg-alt ${!friendId ? 'hidden md:flex' : 'flex'}`}>
        <Outlet context={context} />
      </div>
    </div>
  );
};

export default ChatLayout;
