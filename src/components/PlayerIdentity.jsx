const SILHOUETTE = '/assets/silhouettes/striker_1.svg'
const CLUB_PLACEHOLDER = '/assets/clubs/placeholder.svg'

export default function PlayerIdentity({ name, club, crestUrl }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={SILHOUETTE} alt="" className="h-16 w-16 opacity-90" />
      <p className="font-display text-lg font-semibold text-white leading-tight">{name}</p>
      <div className="flex items-center gap-1.5 text-xs text-white/60">
        <img
          src={crestUrl || CLUB_PLACEHOLDER}
          alt=""
          className="h-4 w-4"
          onError={(e) => {
            e.currentTarget.src = CLUB_PLACEHOLDER
          }}
        />
        <span>{club}</span>
      </div>
    </div>
  )
}
