
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../Theme/ThemeContext'

const Intro = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme() // Theme context
  // Persist to localStorage right when the button is pressed, not just as a side-effect
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-8 p-6 transition-colors duration-300 bg-[var(--color-bg)]">
      {/* Logo — larger container with responsive max bounds */}
      <div className="w-full max-w-md sm:max-w-2xl flex justify-center">
        <img
          src={theme === 'yellow' ? '/yellowIcon.png' : '/yellowIcon.png'}
          alt="ELD Buddy Logo"
          className="w-full max-h-[50vh] object-contain drop-shadow-xl"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/home')}
          className="px-7 py-3.5 rounded-full font-bold text-white cursor-pointer
                     bg-[var(--color-button)] hover:bg-[var(--color-button-hover)]
                     border-2 border-black/15
                     shadow-[0_4px_0_rgba(0,0,0,0.25)]
                     hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(0,0,0,0.25)]
                     active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.25)]
                     transition-all duration-150"
        >
          Go to homepage
        </button>

        <button
          onClick={toggleTheme}
          aria-label="Switch theme"
          className="px-5 py-3.5 rounded-full flex items-center gap-2 cursor-pointer
                     bg-[var(--color-cards)] text-[var(--color-text)]
                     border-2 border-[var(--color-borders)]
                     shadow-[0_4px_0_rgba(0,0,0,0.15)]
                     hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(0,0,0,0.15)]
                     active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.15)]
                     transition-all duration-150"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
          <span className="text-sm font-semibold capitalize">{theme} theme</span>
        </button>
      </div>
    </div>
  )
}

export default Intro