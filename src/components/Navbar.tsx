export default function Navbar() {
  return (
    <nav className="w-full flex justify-between items-center p-6 bg-black text-white">
      <h1 className="text-xl font-bold text-cyan-400">SYNEX</h1>
      <div className="space-x-6">
        <a href="#features" className="hover:text-cyan-400">Features</a>
        <a href="/dashboard" className="bg-cyan-500 px-4 py-2 rounded-lg hover:bg-cyan-600">
          Dashboard
        </a>
      </div>
    </nav>
  );
}