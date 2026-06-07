interface Props {
  title: string;
  description: string;
}

export default function FeatureCard({ title, description }: Props) {
  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg hover:scale-105 transition">
      <h3 className="text-xl font-semibold text-cyan-400 mb-3">{title}</h3>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}