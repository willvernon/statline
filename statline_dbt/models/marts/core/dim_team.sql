select
    team_abbr, -- natty key
    team_id,
    team_name,
    team_nick,
    team_conf,
    team_division,
    team_color,
    team_color2,
    team_logo_espn,
    team_wordmark
from
    {{ref ('stg_nfl_teams')}}
