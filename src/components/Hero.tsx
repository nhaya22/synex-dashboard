export default function Hero() {
  return (
    <section className="h-screen flex flex-col justify-center items-center text-center bg-gradient-to-b from-black to-gray-900 text-white px-6">
      <h1 className="text-5xl font-bold mb-6">
        SYNEX Digital Twin
      </h1>

      <p className="text-lg max-w-2xl text-gray-300 mb-8">
        A GIS–BIM enabled platform for real-time monitoring, simulation,
        and visualization of campus sustainability systems.
      </p>

      <div className="flex gap-4">
        <a href="/dashboard" className="bg-cyan-500 px-6 py-3 rounded-lg hover:bg-cyan-600">
          Enter Dashboard
        </a>

        <a href="#features" className="border border-gray-500 px-6 py-3 rounded-lg hover:border-cyan-400">
          Explore
        </a>
      </div>
    </section>
  );
}