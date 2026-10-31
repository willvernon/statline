-- Grain: 1 row per game FROM {{ref ('stg_nfl_schedules')}}
select
    -- natty key
    game_id,
    -- temporal / type
    season,
    week,
    game_type,
    gameday,
    gametime,
    weekday,
    -- teams
    home_team,
    away_team,
    -- results
    home_score,
    away_score,
    result,
    total,
    overtime,
    location,
    div_game,
    -- venue / weather
    roof,
    surface,
    temp,
    wind,
    stadium_id,
    stadium,
    -- gambling
    away_moneyline,
    home_moneyline,
    spread_line,
    away_spread_odds,
    home_spread_odds,
    total_line,
    under_odds,
    over_odds,
from
    {{ref ('stg_nfl_schedules')}}
