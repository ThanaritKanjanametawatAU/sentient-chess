import ChessBoard from "./_components/ChessBoard";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <h1 className="text-4xl font-bold dark:text-white mb-8">Sentient Chess</h1>
      <ChessBoard />
    </div>
  );
}
