select
    -- natty key
    gsis_id,
    nfl_id,
    display_name,
    first_name,
    last_name,
    suffix,
    birth_date,
    position,
    position_group,
    height,
    weight,
    headshot,
    college_name,
    rookie_season,
    last_season,
    draft_year,
    draft_round,
    draft_pick,
    draft_team,
    status,
    years_of_experience
from
    {{ref ('stg_nfl_players')}}
