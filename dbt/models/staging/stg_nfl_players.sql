-- Grain: 1 row per player.
-- Silver: curated analytics columns + key filter + birth_date cast.

with source as (
    select * from {{ source('raw', 'nfl_players') }}
),

cleaned as (
    select
        gsis_id,
        nfl_id,
        display_name,
        first_name,
        last_name,
        suffix,
        birth_date::date as birth_date,
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
    from source
    where gsis_id is not null
)

select * from cleaned
