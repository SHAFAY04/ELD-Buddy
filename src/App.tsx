import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Home from './pages/home'
import Intro from './pages/intro'
import { ThemeProvider } from './Theme/ThemeContext'
import EldLogs from './pages/eldlogs'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Intro />,
  },
  {
    path: '/home',
    element: <Home />,
  },
  {
    path:'/eld-logs',
    element:<EldLogs/>
  }
])

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </ThemeProvider>
  )
}