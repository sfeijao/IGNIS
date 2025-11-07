import GiveawaysList from '@/components/giveaways/GiveawaysList'
import GiveawayWizard from '@/components/giveaways/GiveawayWizard'

export default function GiveawaysPage(){
  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><span>🎉</span><span>Giveaways</span></h1>
        <GiveawayWizard />
      </div>
      <GiveawaysList />
    </div>
  )
}
