import { Link, useLocation } from 'react-router-dom'
import { useConfig } from '../../hooks/useConfig'

interface MenuItem {
  path: string
  label: string
}

const MENU_ITEMS: MenuItem[] = [{ path: '/dashboard', label: 'Dashboard' }]

export function Sidebar() {
  const location = useLocation()
  const { company, loading } = useConfig()

  return (
    <aside className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Company name */}
      <div className="px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">
          {loading ? '...' : company || 'Company'}
        </span>
      </div>

      {/* Talk to CEO button */}
      <div className="px-3 py-2">
        <Link
          to="/chat"
          className="block w-full px-3 py-2 bg-gray-900 text-white rounded-md text-sm text-center hover:bg-gray-800"
        >
          Talk to CEO
        </Link>
      </div>

      {/* Menu section */}
      <div className="mt-4">
        <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          Menu
        </div>
        <nav className="mt-1">
          {MENU_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-2 text-sm ${
                  isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
