import { Search, Pin, Trash2 } from "lucide-react";

export function ConversationSidebar() {
  return (
    <div className="w-[280px] bg-[#F9FAFB] border-r border-[#E5E7EB] flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations"
            className="w-full bg-white border border-[#E5E7EB] rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
          />
        </div>

        {/* Filter by Date */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Filter by Date
          </h3>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">From</label>
              <input
                type="date"
                className="w-full bg-white border border-[#E5E7EB] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">To</label>
              <input
                type="date"
                className="w-full bg-white border border-[#E5E7EB] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* Filter by Type */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Filter by Type
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
              />
              <span className="text-sm text-gray-700">With Files</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
              />
              <span className="text-sm text-gray-700">Without Files</span>
            </label>
          </div>
        </div>

        {/* Conversations List */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Conversations
          </h3>
          <div className="space-y-2">
            {/* Conversation Card 1 */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-yellow-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800 flex-1 pr-2">
                  Website redesign ideas
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    aria-label="Pin"
                  >
                    <Pin className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                Can you help me brainstorm some modern design trends for our
                company website?
              </p>
              <span className="text-xs text-gray-400">2 hours ago</span>
            </div>

            {/* Conversation Card 2 */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-yellow-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800 flex-1 pr-2">
                  Marketing strategy help
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    aria-label="Pin"
                  >
                    <Pin className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                I need advice on creating a content marketing plan for Q2. What
                should I focus on?
              </p>
              <span className="text-xs text-gray-400">5 hours ago</span>
            </div>

            {/* Conversation Card 3 */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-yellow-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800 flex-1 pr-2">
                  Product feature planning
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    aria-label="Pin"
                  >
                    <Pin className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                We're planning our roadmap. Can you help prioritize features
                based on user feedback?
              </p>
              <span className="text-xs text-gray-400">1 day ago</span>
            </div>

            {/* Conversation Card 4 */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-yellow-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800 flex-1 pr-2">
                  Customer support automation
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    aria-label="Pin"
                  >
                    <Pin className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                How can we implement AI-powered chatbots to handle common
                customer inquiries?
              </p>
              <span className="text-xs text-gray-400">2 days ago</span>
            </div>

            {/* Conversation Card 5 */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-yellow-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800 flex-1 pr-2">
                  Team collaboration tools
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    aria-label="Pin"
                  >
                    <Pin className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                What are the best tools for remote team collaboration and
                project management?
              </p>
              <span className="text-xs text-gray-400">3 days ago</span>
            </div>

            {/* Conversation Card 6 */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-yellow-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800 flex-1 pr-2">
                  Data analytics setup
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    aria-label="Pin"
                  >
                    <Pin className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                I want to track user behavior on our website. What analytics
                tools should we use?
              </p>
              <span className="text-xs text-gray-400">1 week ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Load More Button */}
      <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
        <button className="w-full bg-white hover:bg-gray-50 border border-[#E5E7EB] rounded-lg py-2 text-sm font-medium text-gray-700 transition-colors">
          Load More
        </button>
      </div>
    </div>
  );
}
